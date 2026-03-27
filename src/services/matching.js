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
    const trips = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(trips);
  });
}

/**
 * FRONTEND MATCHING LOGIC
 * Find matching trips and create a SafeCircle without Cloud Functions
 */
export async function findAndMatchTrips(newTripData, newTripId) {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    console.error('❌ User not authenticated');
    return null;
  }

  try {
    console.log('🔍 Starting frontend matching for trip:', newTripId);
    console.log('New Trip Data:', newTripData);

    // Step 1: Fetch all pending trips (excluding current user)
    const tripsQuery = query(
      collection(db, 'trips'),
      where('status', '==', 'pending')
    );

    const tripsSnapshot = await getDocs(tripsQuery);
    console.log(`📊 Found ${tripsSnapshot.size} pending trips in database`);

    // DEBUG: Log trip fields to diagnose issues
    console.log('Trip fields check:', tripsSnapshot.docs.slice(0, 3).map(d => ({
      id: d.id,
      userId: d.data().userId,
      hasUserId: !!d.data().userId
    })));

    // Step 2: Filter trips on frontend
    const matches = [];
    const uniqueUserIds = new Set();
    const newOriginPrefix = newTripData.origin_geohash.substring(0, 4);

    for (const tripDoc of tripsSnapshot.docs) {
      const trip = tripDoc.data();
      const tripId = tripDoc.id;

      // VALIDATION: Ensure userId exists
      if (!trip.userId) {
        console.log(`⏭️  Skipping trip - missing userId`, tripId);
        continue;
      }

      // Skip current user's trips
      if (trip.userId === userId) {
        console.log(`⏭️  Skipping own trip: ${tripId}`);
        continue;
      }

      // Skip if not verified
      if (!trip.isVerified && trip.isVerified !== undefined) {
        console.log(`⏭️  Skipping unverified trip: ${tripId}`);
        continue;
      }

      // RELAXED: Match origin geohash (4-char precision)
      const tripOriginPrefix = trip.origin_geohash?.substring(0, 4) || '';
      if (newOriginPrefix !== tripOriginPrefix) {
        console.log(
          `⏭️  Geohash mismatch for ${tripId}: ` +
            `${tripOriginPrefix} vs ${newOriginPrefix}`
        );
        continue;
      }

      console.log(`✅ Geohash match found: ${tripId}`);

      // STRICT VALIDATION: Fetch and validate user data
      const userRef = doc(db, 'users', trip.userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        console.log(`⏭️  User not found in database: ${trip.userId}`);
        continue;
      }

      const userData = userDoc.data();
      
      // Validate required user fields
      if (!userData?.name) {
        console.log(`⏭️  User has no name field: ${trip.userId}`);
        continue;
      }

      if (userData.verification_status !== 'VERIFIED') {
        console.log(`⏭️  User not verified: ${trip.userId}`);
        continue;
      }

      // DEDUPLICATION: Only add if userId not already in matches
      if (!uniqueUserIds.has(trip.userId)) {
        uniqueUserIds.add(trip.userId);
        matches.push({
          tripId,
          userId: trip.userId,
          name: userData.name,
          reputation: userData.reputation_score || 0,
        });
        console.log(`✅ User ${trip.userId} (${userData.name}) verified, adding to matches`);
      } else {
        console.log(`⏭️  User ${trip.userId} already in matches, skipping duplicate`);
      }
    }

    console.log(`📋 Total matches found: ${matches.length}`);

    // Step 3: Check if we have enough matches (minimum 1 for a circle of 2+)
    if (matches.length < 1) {
      console.log('❌ Not enough matches to form a circle');
      return null;
    }

    // Step 4: Sort by reputation and take top 4
    matches.sort((a, b) => b.reputation - a.reputation);
    const selectedMatches = matches.slice(0, 4);
    console.log(`👥 Selected ${selectedMatches.length} matches for circle`);

    // VALIDATION: Filter only valid members before creating circle
    const validMembers = selectedMatches.filter(m => {
      if (!m.userId || !m.name) {
        console.log(`⏭️  Filtering out invalid member:`, m);
        return false;
      }
      return true;
    });

    if (validMembers.length < 1) {
      console.log('❌ Not enough valid members after filtering');
      return null;
    }

    console.log(`✅ ${validMembers.length} valid members for circle`);

    // Step 5: Create SafeCircle document with VALIDATED data only
    // DEDUPLICATION: Ensure no duplicate userIds in final member list
    const uniqueMemberIds = new Set([userId, ...validMembers.map(m => m.userId)]);
    const allMemberIds = Array.from(uniqueMemberIds);
    console.log(`👥 Final unique members: ${allMemberIds.length}`);
    
    // Ensure all required fields exist
    const meetingPointName = newTripData.origin_landmark || 'Meeting Point';
    const meetingPointLat = newTripData.origin_coords?.lat;
    const meetingPointLng = newTripData.origin_coords?.lng;
    
    if (meetingPointLat === undefined || meetingPointLng === undefined) {
      console.error('❌ Invalid meeting point coordinates');
      return null;
    }

    const circleData = {
      member_ids: allMemberIds,
      meeting_point: {
        name: meetingPointName,
        lat: meetingPointLat,
        lng: meetingPointLng,
      },
      dest_coords: newTripData.dest_coords || { lat: 0, lng: 0 },
      route_summary: `${newTripData.origin_landmark || 'Unknown'} → ${newTripData.destination_landmark || 'Unknown'}`,
      estimated_departure: newTripData.departure_window?.start || new Date(),
      status: 'forming',
      circle_type: newTripData.circle_type || 'Mixed',
      created_at: serverTimestamp(),
      expires_at: new Date(Date.now() + 90 * 60 * 1000),
    };

    console.log('📝 Circle data to create:', {
      members: allMemberIds.length,
      meetingPoint: circleData.meeting_point.name,
      status: circleData.status,
    });

    const circleRef = await addDoc(collection(db, 'safe_circles'), circleData);
    console.log(`✅ SafeCircle created: ${circleRef.id}`);

    // Step 6: Update all trips with circle_id and status = 'matched'
    const batch = writeBatch(db);

    // Update new trip
    batch.update(doc(db, 'trips', newTripId), {
      circle_id: circleRef.id,
      status: 'matched',
    });

    // Update all matched trips
    validMembers.forEach(match => {
      if (match.tripId) {
        batch.update(doc(db, 'trips', match.tripId), {
          circle_id: circleRef.id,
          status: 'matched',
        });
      }
    });

    await batch.commit();
    console.log(`✅ All trips updated with circle_id: ${circleRef.id}`);

    return {
      success: true,
      circleId: circleRef.id,
      memberCount: allMemberIds.length,
      matchedTrips: selectedMatches.length,
    };
  } catch (error) {
    console.error('❌ Matching error:', error);
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
    console.log(`✅ Trip deleted: ${tripId}`);
    return true;
  } catch (error) {
    console.error('❌ Delete trip error:', error);
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
              verified: userData.verification_status === 'VERIFIED',
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
    console.error('❌ Get circle members error:', error);
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
    console.error('❌ Get trip with members error:', error);
    throw error;
  }
}
