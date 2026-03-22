import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { geohashEncode } from '../utils/geohash';

let watchId = null;

/**
 * Start tracking user location and updating Firestore.
 * Updates every 10 seconds using geohash for privacy.
 */
export function startLocationTracking(userId) {
  if (!navigator.geolocation) {
    console.warn('Geolocation not supported');
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      const geohash = geohashEncode(latitude, longitude, 7);

      try {
        await updateDoc(doc(db, 'users', userId), {
          current_geohash: geohash,
          location_updated_at: serverTimestamp(),
        });
      } catch (err) {
        console.error('Location update failed:', err);
      }
    },
    (error) => {
      console.error('Geolocation error:', error.message);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 8000,
    }
  );

  return watchId;
}

/**
 * Stop location tracking.
 */
export function stopLocationTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}
