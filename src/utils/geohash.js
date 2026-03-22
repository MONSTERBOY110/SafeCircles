/**
 * Simple Geohashing for location clustering
 * Encodes (lat, lng) into a compact base-32 string for Firestore queries.
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode a (latitude, longitude) pair into a geohash string.
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} precision - Number of characters (1–12). 7 ≈ 1.2km radius.
 * @returns {string}
 */
export function geohashEncode(latitude, longitude, precision = 7) {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';

  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const lonMid = (lonMin + lonMax) / 2;
      if (longitude > lonMid) {
        idx = (idx << 1) + 1;
        lonMin = lonMid;
      } else {
        idx = idx << 1;
        lonMax = lonMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (latitude > latMid) {
        idx = (idx << 1) + 1;
        latMin = latMid;
      } else {
        idx = idx << 1;
        latMax = latMid;
      }
    }

    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}

/**
 * Decode a geohash string back to approximate (latitude, longitude).
 * @param {string} geohash
 * @returns {{ latitude: number, longitude: number }}
 */
export function geohashDecode(geohash) {
  let evenBit = true;
  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;

  for (let i = 0; i < geohash.length; i++) {
    const idx = BASE32.indexOf(geohash[i]);
    if (idx === -1) throw new Error(`Invalid geohash character: ${geohash[i]}`);

    for (let mask = 16; mask > 0; mask >>= 1) {
      if (evenBit) {
        const lonMid = (lonMin + lonMax) / 2;
        if (idx & mask) {
          lonMin = lonMid;
        } else {
          lonMax = lonMid;
        }
      } else {
        const latMid = (latMin + latMax) / 2;
        if (idx & mask) {
          latMin = latMid;
        } else {
          latMax = latMid;
        }
      }
      evenBit = !evenBit;
    }
  }

  return {
    latitude: (latMin + latMax) / 2,
    longitude: (lonMin + lonMax) / 2,
  };
}
