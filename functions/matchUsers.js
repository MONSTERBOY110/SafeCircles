const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * matchUsers — Triggered when a new trip document is created.
 * Finds overlapping trips with relaxed matching (4-char geohash prefix, origin only).
 * Creates safe_circles and updates all matched trips to 'active' status.
 */
exports.matchUsers = functions.firestore
  .document('trips/{tripId}')
  .onCreate(async (snap, context) => {
    try {
      const newTrip = snap.data();
      const tripId = context.params.tripId;

      console.log("🚀 matchUsers triggered for trip:", tripId);
      console.log("New Trip User ID:", newTrip.user_id);
      console.log("New Trip Origin Geohash:", newTrip.origin_geohash);
      console.log("New Trip Circle Type:", newTrip.circle_type);

      // Ensure minimal valid structure before proceeding
      if (!newTrip.user_id) {
        console.log("❌ No user_id found, skipping match");
        return null;
      }
      
      if (!newTrip.origin_geohash || newTrip.origin_geohash.length < 4) {
        console.log("❌ No valid origin_geohash found");
        return null;
      }

      // Step 1: Query pending trips with same circle type (relaxed matching)
      console.log("📍 Fetching pending trips with circle type:", newTrip.circle_type);
      const candidateSnap = await db.collection('trips')
        .where('status', '==', 'pending')
        .where('circle_type', '==', newTrip.circle_type)
        .get();

      console.log("📊 Fetched trips:", candidateSnap.size);

      const matches = [];
      const newOriginPrefix = newTrip.origin_geohash.substring(0, 4);

      for (const doc of candidateSnap.docs) {
        if (doc.id === tripId) {
          console.log("⏭️  Skipping self:", tripId);
          continue;
        }

        const trip = doc.data();

        // Strict self-match check
        if (trip.user_id === newTrip.user_id) {
          console.log("⏭️  Skipping same user:", trip.user_id);
          continue;
        }

        if (!trip.origin_geohash || trip.origin_geohash.length < 4) {
          console.log("⏭️  Trip", doc.id, "has invalid geohash");
          continue;
        }

        // RELAXED: Match origin geohash with 4-character precision only
        const tripOriginPrefix = trip.origin_geohash.substring(0, 4);
        if (tripOriginPrefix !== newOriginPrefix) {
          console.log(`⏭️  Geohash mismatch for trip ${doc.id}: ${tripOriginPrefix} vs ${newOriginPrefix}`);
          continue;
        }

        console.log(`✅ Geohash match found for trip ${doc.id}`);

        // TODO: Check time overlap (currently skipped for demo)
        // if (!checkTimeOverlap(newTrip.departure_window, trip.departure_window)) {
        //   console.log(`⏭️  Time mismatch for trip ${doc.id}`);
        //   continue;
        // }

        // Fetch User for verification
        const userDoc = await db.collection('users').doc(trip.user_id).get();
        if (!userDoc.exists) {
          console.log(`⏭️  User not found for trip ${doc.id}`);
          continue;
        }

        const userData = userDoc.data();
        if (userData.verification_status !== 'VERIFIED') {
          console.log(`⏭️  User not verified for trip ${doc.id}: ${userData.verification_status}`);
          continue;
        }

        console.log(`✅ User ${trip.user_id} verified, adding to matches`);
        matches.push({
          tripId: doc.id,
          userId: trip.user_id,
          reputation: userData.reputation_score || 0,
        });
      }

      console.log("After Geohash Filter:", matches.length);

      // Step 2: Sort by reputation, take top 4
      matches.sort((a, b) => b.reputation - a.reputation);
      const selectedMatches = matches.slice(0, 4);

      console.log("Final Matches:", selectedMatches.length);

      // Minimum match check
      if (selectedMatches.length < 1) {
        console.log(`❌ Not enough users to match for trip ${tripId}`);
        return null;
      }

      // Step 3: Create safe_circles document
      const allMemberIds = [newTrip.user_id, ...selectedMatches.map(m => m.userId)];
      console.log("Creating circle with members:", allMemberIds);

      const batch = db.batch();
      
      // Create new safe_circles document
      const circleRef = db.collection('safe_circles').doc();
      batch.set(circleRef, {
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

      console.log("✅ Safe circle created with ID:", circleRef.id);

      // Update the new trip
      batch.update(db.collection('trips').doc(tripId), {
        circle_id: circleRef.id,
        status: 'active',
      });
      console.log("Updating original trip:", tripId);

      // Update all matched trips
      for (const match of selectedMatches) {
        batch.update(db.collection('trips').doc(match.tripId), {
          circle_id: circleRef.id,
          status: 'active',
        });
        console.log("Updating matched trip:", match.tripId);
      }

      await batch.commit();

      console.log(`✅ Circle ${circleRef.id} created with ${allMemberIds.length} members`);
      return { success: true, circleId: circleRef.id };

    } catch (error) {
      console.error('❌ matchUsers error:', error);
      console.error('Error stack:', error.stack);
      throw error;
    }
  });
