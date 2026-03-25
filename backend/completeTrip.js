const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * completeTrip — callable function to mark a trip as safely completed.
 * Increments reputation for all circle members.
 */
exports.completeTrip = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { tripId, circleId } = data;
  if (!tripId || !circleId) {
    throw new functions.https.HttpsError('invalid-argument', 'tripId and circleId are required');
  }

  try {
    const circleDoc = await db.collection('safe_circles').doc(circleId).get();
    if (!circleDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Circle not found');
    }

    const memberIds = circleDoc.data().member_ids || [];
    const batch = db.batch();

    // Increment reputation for all members
    memberIds.forEach(memberId => {
      batch.update(db.collection('users').doc(memberId), {
        reputation_score: admin.firestore.FieldValue.increment(1),
        successful_trips: admin.firestore.FieldValue.increment(1),
        last_active: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    // Mark circle as completed
    batch.update(db.collection('safe_circles').doc(circleId), {
      status: 'completed',
      completed_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Mark trip as completed
    batch.update(db.collection('trips').doc(tripId), {
      status: 'completed',
      completed_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
    return { success: true, message: 'Trip completed! Reputation updated.' };

  } catch (err) {
    console.error('completeTrip error:', err);
    throw new functions.https.HttpsError('internal', err.message);
  }
});
