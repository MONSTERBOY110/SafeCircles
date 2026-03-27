const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * matchUsers — triggered when a new trip document is created.
 * Finds overlapping trips and creates a safe_circles document.
 */
exports.matchUsers = functions.firestore
    .document("trips/{tripId}")
    .onCreate(async (snap, context) => {
      const newTrip = snap.data();
      const tripId = context.params.tripId;

      console.log("🚀 matchUsers triggered");
      console.log("New Trip User ID:", newTrip.user_id);
      console.log("New Trip Origin Geohash:", newTrip.origin_geohash);
      console.log("New Trip Circle Type:", newTrip.circle_type);

      // Don't try to match users who haven't been verified
      if (!newTrip.user_id) {
        console.log("❌ No user_id found");
        return null;
      }

      try {
        // Step 1: Find pending trips with same circle type (relaxed matching)
        console.log(
            "📍 Fetching pending trips with circle type:",
            newTrip.circle_type,
        );
        const candidateSnap = await db.collection("trips")
            .where("status", "==", "pending")
            .where("circle_type", "==", newTrip.circle_type)
            .get();

        console.log("📊 Fetched trips:", candidateSnap.size);

        const matches = [];

        // Step 2: Filter by geohash (4-char precision, origin only)
        for (const doc of candidateSnap.docs) {
          if (doc.id === tripId) continue;

          const trip = doc.data();

          // RELAXED: Match origin geohash with 4-character precision only
          const newOriginPrefix = newTrip.origin_geohash.substring(0, 4);
          const tripOriginPrefix = trip.origin_geohash.substring(0, 4);

          if (newOriginPrefix !== tripOriginPrefix) {
            console.log(
                `⏭️  Skipping trip ${doc.id}: geohash mismatch ` +
                  `(${tripOriginPrefix} vs ${newOriginPrefix})`,
            );
            continue;
          }

          console.log(
              `✅ Geohash match found for trip ${doc.id}`,
          );

          // TEMPORARY: Skip time overlap check for demo
          // const overlaps = checkTimeOverlap(
          //   newTrip.departure_window,
          //   trip.departure_window
          // );
          // if (!overlaps) {
          //   console.log(`⏭️  Skipping trip ${doc.id}: time mismatch`);
          //   continue;
          // }

          const userDoc = await db.collection("users").doc(trip.user_id).get();
          if (!userDoc.exists) {
            console.log(`⏭️  Skipping trip ${doc.id}: user not found`);
            continue;
          }

          const userData = userDoc.data();
          if (userData.verification_status !== "VERIFIED") {
            console.log(
                `⏭️  Skipping trip ${doc.id}: user not verified ` +
                  `(status: ${userData.verification_status})`,
            );
            continue;
          }

          console.log(`✅ User ${trip.user_id} verified, adding to matches`);
          matches.push({
            tripId: doc.id,
            data: trip,
            reputation: userData.reputation_score || 0,
          });
        }

        console.log("After Geohash Filter:", matches.length);

        // Step 3: Sort by reputation, take top 4
        matches.sort((a, b) => b.reputation - a.reputation);
        const selected = matches.slice(0, 4);

        console.log("Final Matches:", selected.length);

        if (selected.length < 1) {
          console.log(`❌ No matches found for trip ${tripId}`);
          return null;
        }

        // Step 4: Create safe_circles document
        const allMemberIds = [
          newTrip.user_id,
          ...selected.map((m) => m.data.user_id),
        ];
        console.log("Creating circle with members:", allMemberIds);

        const circleRef = await db.collection("safe_circles").add({
          member_ids: allMemberIds,
          meeting_point: {
            name: newTrip.origin_landmark,
            lat: newTrip.origin_coords.lat,
            lng: newTrip.origin_coords.lng,
            cctv_coverage: true,
            police_booth_nearby: true,
          },
          dest_coords: newTrip.dest_coords,
          route_summary: (
            `${newTrip.origin_landmark} → ${newTrip.destination_landmark}`
          ),
          estimated_departure: newTrip.departure_window.start,
          status: "forming",
          circle_type: newTrip.circle_type,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          expires_at: new Date(Date.now() + 90 * 60 * 1000),
        });

        console.log("✅ Safe circle created with ID:", circleRef.id);

        // Step 5: Batch-update all trips with the circle_id
        const batch = db.batch();
        batch.update(db.collection("trips").doc(tripId), {
          circle_id: circleRef.id,
          status: "active",
        });
        console.log("Updating original trip:", tripId);

        selected.forEach((m) => {
          batch.update(db.collection("trips").doc(m.tripId), {
            circle_id: circleRef.id,
            status: "active",
          });
          console.log("Updating matched trip:", m.tripId);
        });

        await batch.commit();

        console.log(
            `✅ Circle ${circleRef.id} created with ` +
              `${allMemberIds.length} members`,
        );
        return {success: true, circleId: circleRef.id};
      } catch (err) {
        console.error("❌ matchUsers error:", err);
        console.error("Error stack:", err.stack);
        throw err;
      }
    });


