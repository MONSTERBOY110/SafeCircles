/**
 * Coordinate and bounding box utilities.
 */

/**
 * Get the center point of an array of coordinates.
 * @param {{ lat: number, lng: number }[]} coords
 * @returns {{ lat: number, lng: number }}
 */
export function getCenterPoint(coords) {
  if (!coords || coords.length === 0) return { lat: 0, lng: 0 };
  const lat = coords.reduce((sum, c) => sum + c.lat, 0) / coords.length;
  const lng = coords.reduce((sum, c) => sum + c.lng, 0) / coords.length;
  return { lat, lng };
}

/**
 * Get a bounding box around a center point with a given radius in km.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusKm
 */
export function getBoundingBox(lat, lng, radiusKm) {
  const latDelta = radiusKm / 111; // 1 degree lat ≈ 111 km
  const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

/**
 * Check if a point is within a bounding box.
 */
export function isInBoundingBox(lat, lng, bbox) {
  return lat >= bbox.minLat && lat <= bbox.maxLat &&
         lng >= bbox.minLng && lng <= bbox.maxLng;
}

/**
 * Convert degrees to radians.
 */
export function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}
