/**
 * Haversine Formula for great-circle distance calculation between two GPS points.
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Calculate distance between two (lat, lng) points in km.
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Calculate estimated walking time in minutes between two points.
 * @param {number} walkingSpeedKmh - Default 5 km/h
 */
export function calculateETA(lat1, lon1, lat2, lon2, walkingSpeedKmh = 5) {
  const distanceKm = calculateDistance(lat1, lon1, lat2, lon2);
  const timeHours = distanceKm / walkingSpeedKmh;
  return Math.round(timeHours * 60);
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}
