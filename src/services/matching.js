import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  getDocs,
  updateDoc,
  doc,
  writeBatch,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { geohashEncode } from '../utils/geohash';
import { calculateDistance } from '../utils/haversine';

/**
 * Create a new trip document in Firestore.
 */
export async function createTrip(tripData) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const { origin, destination, departureTime, circlePreference, originCoords, destCoords } = tripData;

  const [hours, minutes] = departureTime.split(':');
  const departureDate = new Date();
  departureDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  const arrivalDate = new Date(departureDate.getTime() + 15 * 60 * 1000);

  const originGeohash = geohashEncode(originCoords.lat, originCoords.lng, 7);
  const destGeohash = geohashEncode(destCoords.lat, destCoords.lng, 7);

  const tripRef = await addDoc(collection(db, 'trips'), {
    userId: user.uid,
    origin_landmark: origin,
    destination_landmark: destination,
    origin_coords: originCoords,
    dest_coords: destCoords,
    origin_geohash: originGeohash,
    dest_geohash: destGeohash,
    departure_window: {
      start: departureDate,
      end: arrivalDate,
    },
    circle_type: circlePreference,
    status: 'pending',
    circle_id: null,
    created_at: serverTimestamp(),
    expires_at: new Date(Date.now() + 90 * 60 * 1000),
  });

  return tripRef.id;
}

/**
 * Listen for real-time updates to a trip.
 */
export function listenToTrip(tripId, callback) {
  const { doc, onSnapshot: snap } = require('firebase/firestore');
  const tripRef = doc(db, 'trips', tripId);
  return snap(tripRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    }
  });
}

/**
 * Listen to user's active trips.
 */
export function listenToUserTrips(userId, callback) {
  const q = query(
    collection(db, 'trips'),
    where('userId', '==', userId),
    where('status', 'in', ['pending', 'active', 'matched'])
  );
  return onSnapshot(q, (snapshot) => {
    const trips = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(trips);
  });
}

/**
 * Calculate approximate path overlap between two routes
 * Checks if origin and destination are both geographically close
 */
function calculatePathOverlap(trip1Coords, trip2Coords) {
  if (!trip1Coords?.origin || !trip1Coords?.dest || 
      !trip2Coords?.origin || !trip2Coords?.dest) {
    return 0;
  }

  // Calculate distances between origins and destinations
  const originDistance = calculateDistance(
    trip1Coords.origin.lat, trip1Coords.origin.lng,
    trip2Coords.origin.lat, trip2Coords.origin.lng
  );

  const destDistance = calculateDistance(
    trip1Coords.dest.lat, trip1Coords.dest.lng,
    trip2Coords.dest.lat, trip2Coords.dest.lng
  );

  // Both origin and destination should be within 5km for a good match
  const originOverlap = originDistance <= 5;
  const destOverlap = destDistance <= 5;

  // Return overlap score (0-100)
  // Full match if both are within 5km, partial if only one is close
  if (originOverlap && destOverlap) {
    return 100 - (originDistance + destDistance); // Favor closer matches
  } else if (originOverlap || destOverlap) {
    return 30; // Partial overlap
  }
  return 0; // No overlap
}

/**
 * Check if departure times overlap sufficiently
 */
function checkDepartureWindowOverlap(window1, window2, toleranceMinutes = 30) {
  if (!window1?.start || !window2?.start) return true; // Default to true if not provided

  const start1 = window1.start instanceof Date ? window1.start : new Date(window1.start);
  const start2 = window2.start instanceof Date ? window2.start : new Date(window2.start);

  const timeDiff = Math.abs(start1 - start2) / (1000 * 60); // Convert to minutes
  return timeDiff <= toleranceMinutes;
}

/**
 * FRONTEND MATCHING LOGIC
 * Find matching trips and create a SafeCircle without Cloud Functions
 * Supports multiple users (2-10) with overlapping routes
 */
export async function findAndMatchTrips(newTripData, newTripId) {
  const currentUserId = newTripData?.userId || auth.currentUser?.uid;
  if (!currentUserId) {
    console.error('User not authenticated');
    return null;
  }

  try {
    console.log('Starting frontend matching for trip:', newTripId);
    console.log('New Trip Data:', newTripData);

    if (!newTripData?.origin_geohash || !newTripData?.dest_geohash) {
      console.log('Skipping invalid new trip:', newTripId);
      return null;
    }

    const tripsQuery = query(
      collection(db, 'trips'),
      where('status', '==', 'pending')
    );

    const tripsSnapshot = await getDocs(tripsQuery);
    console.log(`Found ${tripsSnapshot.size} pending trips in database`);

    const matches = [];
    const uniqueUserIds = new Set();
    const newOriginPrefix = newTripData.origin_geohash.substring(0, 4);
    const newDestPrefix = newTripData.dest_geohash.substring(0, 4);

    // Prepare new trip coordinates for path overlap calculation
    const newTripCoords = {
      origin: newTripData.origin_coords,
      dest: newTripData.dest_coords,
    };

    for (const tripDoc of tripsSnapshot.docs) {
      const trip = { id: tripDoc.id, ...tripDoc.data() };

      if (!trip.userId || !trip.origin_geohash || !trip.dest_geohash) {
        console.log('Skipping invalid trip:', trip.id);
        continue;
      }

      if (trip.id === newTripId) {
        continue;
      }

      if (trip.userId === currentUserId) {
        continue;
      }

      // Check origin geohash prefix match (primary filter)
      const tripOriginPrefix = trip.origin_geohash.substring(0, 4);
      if (newOriginPrefix !== tripOriginPrefix) {
        continue;
      }

      // Check destination geohash prefix match (secondary filter)
      const tripDestPrefix = trip.dest_geohash.substring(0, 4);
      if (newDestPrefix !== tripDestPrefix) {
        console.log(`Trip ${trip.id} has different destination prefix`);
        continue;
      }

      // Check departure window overlap
      if (!checkDepartureWindowOverlap(newTripData.departure_window, trip.departure_window)) {
        console.log(`Trip ${trip.id} has non-overlapping departure time`);
        continue;
      }

      const userDoc = await getDoc(doc(db, 'users', trip.userId));
      if (!userDoc.exists()) {
        continue;
      }

      const userData = userDoc.data();
      const isUserVerified =
        userData?.isVerified === true ||
        userData?.verification_status === 'VERIFIED';

      if (!userData || !isUserVerified) {
        continue;
      }

      if (uniqueUserIds.has(trip.userId)) {
        continue;
      }

      // Calculate path overlap score
      const tripCoords = {
        origin: trip.origin_coords,
        dest: trip.dest_coords,
      };
      const overlapScore = calculatePathOverlap(newTripCoords, tripCoords);

      uniqueUserIds.add(trip.userId);
      matches.push({
        tripId: trip.id,
        userId: trip.userId,
        name: userData.name || 'User',
        reputation: userData.reputation || userData.reputation_score || 0,
        overlapScore: overlapScore,
      });
    }

    console.log('Matches found:', matches.length);

    const uniqueMatches = [];
    const seen = new Set();

    for (const m of matches) {
      if (!m?.userId || seen.has(m.userId)) {
        continue;
      }

      seen.add(m.userId);
      uniqueMatches.push(m);
    }

    // Sort by reputation first, then by overlap score
    uniqueMatches.sort((a, b) => {
      if (b.reputation !== a.reputation) {
        return b.reputation - a.reputation;
      }
      return b.overlapScore - a.overlapScore;
    });

    // Take up to 10 members (including current user, total circle can be 2-11)
    const finalMembers = uniqueMatches.slice(0, 10);

    if (finalMembers.length < 1) {
      console.log('Not enough users to form circle');
      return null;
    }

    const uniqueMemberIds = new Set([currentUserId, ...finalMembers.map((m) => m.userId)]);
    const allMemberIds = Array.from(uniqueMemberIds);

    const routeOrigin = newTripData.origin_landmark || newTripData.origin || 'Unknown';
    const routeDestination = newTripData.destination_landmark || newTripData.destination || 'Unknown';
    const meetingPointName = newTripData.origin || newTripData.origin_landmark || 'Meeting Point';
    const meetingPointLat = newTripData.origin_coords?.lat;
    const meetingPointLng = newTripData.origin_coords?.lng;
    const estimatedDeparture =
      newTripData.departure_window?.start ||
      newTripData.timeWindowStart ||
      new Date();
    const circleType = newTripData.circle_type || newTripData.circleType || 'Mixed';
    const destCoords = newTripData.dest_coords && typeof newTripData.dest_coords.lat === 'number' && typeof newTripData.dest_coords.lng === 'number'
      ? newTripData.dest_coords
      : { lat: meetingPointLat, lng: meetingPointLng };

    if (typeof meetingPointLat !== 'number' || typeof meetingPointLng !== 'number') {
      console.error('Invalid meeting point coordinates');
      return null;
    }

    console.log('Creating circle...');

    const circleData = {
      member_ids: allMemberIds,
      meetingPoint: meetingPointName,
      meeting_point: {
        name: meetingPointName,
        lat: meetingPointLat,
        lng: meetingPointLng,
      },
      dest_coords: destCoords,
      route_summary: `${routeOrigin} → ${routeDestination}`,
      estimated_departure: estimatedDeparture,
      status: 'forming',
      circle_type: circleType,
      created_at: serverTimestamp(),
      expires_at: new Date(Date.now() + 90 * 60 * 1000),
    };

    const circleRef = await addDoc(collection(db, 'safe_circles'), circleData);
    console.log(`SafeCircle created: ${circleRef.id}`);

    const batch = writeBatch(db);

    batch.update(doc(db, 'trips', newTripId), {
      circle_id: circleRef.id,
      status: 'matched',
    });

    finalMembers.forEach((match) => {
      if (match.tripId) {
        batch.update(doc(db, 'trips', match.tripId), {
          circle_id: circleRef.id,
          status: 'matched',
        });
      }
    });

    await batch.commit();
    console.log(`All trips updated with circle_id: ${circleRef.id}`);

    return {
      success: true,
      circleId: circleRef.id,
      memberCount: allMemberIds.length,
      matchedTrips: finalMembers.length,
    };
  } catch (error) {
    console.error('Matching error:', error);
    return null;
  }
}

/**
 * Delete a trip (only if status is 'pending')
 */
export async function deleteTrip(tripId) {
  try {
    const tripDoc = await getDoc(doc(db, 'trips', tripId));

    if (!tripDoc.exists()) {
      throw new Error('Trip not found');
    }

    const trip = tripDoc.data();

    // Only allow delete if trip is pending
    if (trip.status !== 'pending') {
      throw new Error('Can only delete trips with pending status');
    }

    await deleteDoc(doc(db, 'trips', tripId));
    console.log(`Trip deleted: ${tripId}`);
    return true;
  } catch (error) {
    console.error('Delete trip error:', error);
    throw error;
  }
}

/**
 * Get circle members with their details
 */
export async function getCircleMembers(circleId) {
  try {
    const circleDoc = await getDoc(doc(db, 'safe_circles', circleId));

    if (!circleDoc.exists()) {
      throw new Error('Circle not found');
    }

    const circle = circleDoc.data();
    const memberIds = circle.member_ids || [];

    const memberDetails = await Promise.all(
      memberIds.map(async (uid) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            return {
              uid,
              name: userData.name || 'User',
              reputation: userData.reputation_score || 0,
              verified:
                userData.isVerified === true ||
                userData.verification_status === 'VERIFIED',
            };
          }
        } catch (err) {
          console.error(`Error fetching member ${uid}:`, err);
        }
        return { uid, name: 'User', reputation: 0, verified: false };
      })
    );

    return memberDetails;
  } catch (error) {
    console.error('Get circle members error:', error);
    throw error;
  }
}

/**
 * Get trip with member information
 */
export async function getTripWithMembers(tripId) {
  try {
    const tripDoc = await getDoc(doc(db, 'trips', tripId));

    if (!tripDoc.exists()) {
      throw new Error('Trip not found');
    }

    const trip = tripDoc.data();

    if (trip.circle_id) {
      const members = await getCircleMembers(trip.circle_id);
      return { id: tripDoc.id, ...trip, members };
    }

    return { id: tripDoc.id, ...trip, members: [] };
  } catch (error) {
    console.error('Get trip with members error:', error);
    throw error;
  }
}
