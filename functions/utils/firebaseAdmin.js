const admin = require('firebase-admin');

// Expose initialized Firestore and Auth for use in Cloud Functions
const db = admin.firestore();
const adminAuth = admin.auth();

module.exports = { db, adminAuth };
