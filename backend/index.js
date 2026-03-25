const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();

// Import function handlers
const { matchUsers } = require('./matchUsers');
const { completeTrip } = require('./completeTrip');
const { reportIncident } = require('./reportIncident');
const { cleanupExpiredTrips } = require('./cleanupExpiredTrips');

// Export all Cloud Functions
exports.matchUsers = matchUsers;
exports.completeTrip = completeTrip;
exports.reportIncident = reportIncident;
exports.cleanupExpiredTrips = cleanupExpiredTrips;
