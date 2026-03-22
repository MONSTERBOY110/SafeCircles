const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * cleanupExpiredTrips — scheduled function running every 30 minutes.
 * Deletes trips and circles past their expires_at timestamp.
 */
exports.cleanupExpiredTrips = functions.pubsub
  .schedule('every 30 minutes')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();
    let deleteCount = 0;

    // Clean expired trips
    const expiredTrips = await db.collection('trips')
      .where('expires_at', '<', now)
      .where('status', 'in', ['pending', 'completed'])
      .limit(100)
      .get();

    expiredTrips.docs.forEach(doc => {
      batch.delete(doc.ref);
      deleteCount++;
    });

    // Clean expired circles
    const expiredCircles = await db.collection('safe_circles')
      .where('expires_at', '<', now)
      .where('status', 'in', ['forming', 'completed'])
      .limit(100)
      .get();

    expiredCircles.docs.forEach(doc => {
      batch.delete(doc.ref);
      deleteCount++;
    });

    // Clean expired safety pings (older than 1 hour)
    const expiredPings = await db.collection('safety_pings')
      .where('expires_at', '<', now)
      .limit(100)
      .get();

    expiredPings.docs.forEach(doc => {
      batch.delete(doc.ref);
      deleteCount++;
    });

    if (deleteCount > 0) {
      await batch.commit();
      console.log(`🧹 Cleaned up ${deleteCount} expired documents`);
    }

    return null;
  });
