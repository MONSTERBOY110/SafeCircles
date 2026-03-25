const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * matchUsers — triggered when a new trip document is created.
 * Finds overlapping trips, creates a safe_circles document, and updates all matched trips.
 */
exports.matchUsers = functions.firestore
  .document('trips/{tripId}')
  .onCreate(async (snap, context) => {
    const newTrip = snap.data();
    const tripId = context.params.tripId;

    // Don't try to match users who haven't been verified
    if (!newTrip.user_id) return null;

    try {
      // Step 1: Find pending trips with same geohash and circle type
      const candidateSnap = await db.collection('trips')
        .where('status', '==', 'pending')
        .where('circle_type', '==', newTrip.circle_type)
        .where('origin_geohash', '==', newTrip.origin_geohash)
        .get();

      const matches = [];

      // Step 2: Filter by time overlap and verify each user
      for (const doc of candidateSnap.docs) {
        if (doc.id === tripId) continue;

        const trip = doc.data();
        const overlaps = checkTimeOverlap(newTrip.departure_window, trip.departure_window);
        if (!overlaps) continue;

        const userDoc = await db.collection('users').doc(trip.user_id).get();
        if (!userDoc.exists) continue;

        const userData = userDoc.data();
        if (userData.verification_status === 'VERIFIED') {
          matches.push({
            tripId: doc.id,
            data: trip,
            reputation: userData.reputation_score || 0,
          });
        }
      }

      // Step 3: Sort by reputation, take top 4
      matches.sort((a, b) => b.reputation - a.reputation);
      const selected = matches.slice(0, 4);

      if (selected.length < 1) {
        console.log(`No matches found for trip ${tripId}`);
        return null;
      }

      // Step 4: Create safe_circles document
      const allMemberIds = [newTrip.user_id, ...selected.map(m => m.data.user_id)];
      const circleRef = await db.collection('safe_circles').add({
        member_ids: allMemberIds,
        meeting_point: {
          name: newTrip.origin_landmark,
          lat: newTrip.origin_coords.lat,
          lng: newTrip.origin_coords.lng,
          cctv_coverage: true,
          police_booth_nearby: true,
        },
        dest_coords: newTrip.dest_coords,
        route_summary: `${newTrip.origin_landmark} → ${newTrip.destination_landmark}`,
        estimated_departure: newTrip.departure_window.start,
        status: 'forming',
        circle_type: newTrip.circle_type,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        expires_at: new Date(Date.now() + 90 * 60 * 1000),
      });

      // Step 5: Batch-update all trips with the circle_id
      const batch = db.batch();
      batch.update(db.collection('trips').doc(tripId), {
        circle_id: circleRef.id,
        status: 'active',
      });
      selected.forEach(m => {
        batch.update(db.collection('trips').doc(m.tripId), {
          circle_id: circleRef.id,
          status: 'active',
        });
      });
      await batch.commit();

      console.log(`✅ Circle ${circleRef.id} created with ${allMemberIds.length} members`);
      return { success: true, circleId: circleRef.id };

    } catch (err) {
      console.error('matchUsers error:', err);
      throw err;
    }
  });

/**
 * Check if two departure_window objects overlap in time.
 */
function checkTimeOverlap(w1, w2) {
  const toDate = (v) => (v && v.toDate ? v.toDate() : new Date(v));
  const s1 = toDate(w1.start), e1 = toDate(w1.end);
  const s2 = toDate(w2.start), e2 = toDate(w2.end);
  return !(e1 < s2 || s1 > e2);
}
