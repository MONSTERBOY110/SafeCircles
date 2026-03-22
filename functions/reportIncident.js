const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * reportIncident — callable function to report harassment or unsafe behavior.
 * Reduces reported user's reputation and flags them for moderation.
 */
exports.reportIncident = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { reportedUserId, circleId, description, incidentType } = data;

  try {
    // Create incident report
    const reportRef = await db.collection('incident_reports').add({
      reporter_id: context.auth.uid,
      reported_user_id: reportedUserId,
      circle_id: circleId || null,
      description: description || '',
      incident_type: incidentType || 'harassment',
      status: 'open',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Decrement reported user's reputation
    await db.collection('users').doc(reportedUserId).update({
      reputation_score: admin.firestore.FieldValue.increment(-5),
      report_count: admin.firestore.FieldValue.increment(1),
    });

    // Check if user should be flagged (2+ reports)
    const userDoc = await db.collection('users').doc(reportedUserId).get();
    const reportCount = (userDoc.data().report_count || 0);
    if (reportCount >= 2) {
      await db.collection('users').doc(reportedUserId).update({
        is_flagged: true,
        flag_reason: 'Multiple reports received',
      });
    }

    return { success: true, reportId: reportRef.id };

  } catch (err) {
    console.error('reportIncident error:', err);
    throw new functions.https.HttpsError('internal', err.message);
  }
});
