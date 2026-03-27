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
    user_id: user.uid,
    user_name: user.displayName || 'User',
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
    where('user_id', '==', userId),
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

    // Step 2: Filter trips on frontend
    const matches = [];
    const newOriginPrefix = newTripData.origin_geohash.substring(0, 4);

    for (const tripDoc of tripsSnapshot.docs) {
      const trip = tripDoc.data();
      const tripId = tripDoc.id;

      // Skip current user's trips
      if (trip.user_id === userId) {
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

      // Fetch user data to verify verification status if needed
      const userDoc = await getDoc(doc(db, 'users', trip.user_id));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.verification_status === 'VERIFIED') {
          matches.push({
            tripId,
            userId: trip.user_id,
            userName: trip.user_name || 'User',
            reputation: userData.reputation_score || 0,
          });
          console.log(`✅ User ${trip.user_id} verified, adding to matches`);
        }
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

    // Step 5: Create SafeCircle document
    const allMemberIds = [userId, ...selectedMatches.map(m => m.userId)];
    const circleData = {
      member_ids: allMemberIds,
      meeting_point: {
        name: newTripData.origin_landmark,
        lat: newTripData.origin_coords.lat,
        lng: newTripData.origin_coords.lng,
      },
      dest_coords: newTripData.dest_coords,
      route_summary:
        `${newTripData.origin_landmark} → ${newTripData.destination_landmark}`,
      estimated_departure: newTripData.departure_window.start,
      status: 'forming',
      circle_type: newTripData.circle_type,
      created_at: serverTimestamp(),
      expires_at: new Date(Date.now() + 90 * 60 * 1000),
    };

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
    selectedMatches.forEach(match => {
      batch.update(doc(db, 'trips', match.tripId), {
        circle_id: circleRef.id,
        status: 'matched',
      });
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
