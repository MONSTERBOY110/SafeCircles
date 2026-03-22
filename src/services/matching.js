import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp
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
    where('status', 'in', ['pending', 'active'])
  );
  return onSnapshot(q, (snapshot) => {
    const trips = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(trips);
  });
}
