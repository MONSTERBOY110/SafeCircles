/**
 * Shared matching utilities for Cloud Functions (Node.js).
 */

/**
 * Check if two departure_window objects overlap.
 * @param {{ start, end }} w1
 * @param {{ start, end }} w2
 * @returns {boolean}
 */
function checkTimeOverlap(w1, w2) {
  const toDate = (v) => (v && v.toDate ? v.toDate() : new Date(v));
  const s1 = toDate(w1.start), e1 = toDate(w1.end);
  const s2 = toDate(w2.start), e2 = toDate(w2.end);
  return !(e1 < s2 || s1 > e2);
}

/**
 * Sort an array of candidate trips by reputation (descending).
 * @param {{ reputation: number }[]} candidates
 * @returns {typeof candidates}
 */
function sortByReputation(candidates) {
  return [...candidates].sort((a, b) => b.reputation - a.reputation);
}

/**
 * Calculate walking ETA between two points.
 * @param {number} lat1 @param {number} lon1
 * @param {number} lat2 @param {number} lon2
 * @returns {number} Minutes
 */
function calculateETA(lat1, lon1, lat2, lon2) {
  const toRad = (d) => d * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distKm = R * c;
  return Math.round((distKm / 5) * 60); // 5 km/h walking
}

module.exports = { checkTimeOverlap, sortByReputation, calculateETA };
