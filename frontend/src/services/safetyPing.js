import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { geohashEncode } from '../utils/geohash';

/**
 * Submit a safety ping from the current user.
 * @param {number} lat
 * @param {number} lng
 * @param {'safe'|'moderate'|'avoid'} level
 * @param {string} [note] - Optional note
 */
export async function submitSafetyPing(lat, lng, level, note = '') {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const geohash = geohashEncode(lat, lng, 7);

  await addDoc(collection(db, 'safety_pings'), {
    user_id: user.uid,
    geohash,
    level,        // 'safe' | 'moderate' | 'avoid'
    note,
    lat,
    lng,
    created_at: serverTimestamp(),
    expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour TTL
  });
}

/**
 * Listen to safety pings for a geohash area.
 */
export function listenToSafetyPings(geohash, callback) {
  const { query, where, onSnapshot } = require('firebase/firestore');
  const q = query(
    collection(db, 'safety_pings'),
    where('geohash', '==', geohash)
  );
  return onSnapshot(q, (snapshot) => {
    const pings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(pings);
  });
}
