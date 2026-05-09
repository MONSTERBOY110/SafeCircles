/**
 * Build a `sms:` URI prefilled with the SOS body for one or more recipients.
 *
 * Android Chrome → Google Messages and Samsung Internet → Samsung Messages both
 * accept comma-separated recipients. iOS Safari uses ampersand instead; this
 * helper targets Android first (the project's primary mobile platform). The
 * returned URI MUST be assigned via `window.location.href` inside a synchronous
 * user-gesture handler to avoid popup-blocker / intent-filter rejection.
 *
 * @param {Array<{name: string, phone: string}>} contacts
 * @param {number|undefined} lat
 * @param {number|undefined} lng
 * @param {string|undefined} userName
 * @returns {string} sms: URI ready to assign to window.location.href
 */
export function buildSosSmsHref(contacts, lat, lng, userName) {
  const numbers = (contacts || [])
    .map((c) => (c?.phone || '').replace(/[^\d+]/g, ''))
    .filter(Boolean);

  const hasCoords = typeof lat === 'number' && typeof lng === 'number';
  const mapsUrl = hasCoords ? `https://www.google.com/maps?q=${lat},${lng}` : '';
  const who = userName ? `${userName} needs` : 'I need';
  const body = [
    `SafeCircles SOS: ${who} help.`,
    mapsUrl ? `Location: ${mapsUrl}` : 'Location unavailable.',
  ].join(' ');

  const recipients = numbers.join(',');
  return `sms:${recipients}?&body=${encodeURIComponent(body)}`;
}

/**
 * Build a `sms:` URI to notify the user's emergency contacts that a trip just
 * matched (i.e. the journey is starting). Includes source landmark, destination
 * landmark, and a Google Maps link to the user's current GPS position. Falls
 * back gracefully when source/destination/coords are missing.
 *
 * Uses the same recipient-encoding + gesture-required navigation pattern as
 * `buildSosSmsHref`. Assign via `window.location.href` inside a real user-tap
 * handler.
 *
 * @param {Array<{name:string, phone:string}>} contacts
 * @param {{ origin_landmark?:string, destination_landmark?:string, circle_id?:string|null }} trip
 * @param {{lat:number, lng:number}|null|undefined} location
 * @param {string|undefined} userName
 * @returns {string} sms: URI
 */
export function buildTripStartSmsHref(contacts, trip, location, userName) {
  const numbers = (contacts || [])
    .map((c) => (c?.phone || '').replace(/[^\d+]/g, ''))
    .filter(Boolean);
  const recipients = numbers.join(',');

  const hasCoords =
    location &&
    typeof location.lat === 'number' &&
    typeof location.lng === 'number';
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${location.lat},${location.lng}`
    : '';

  const who = userName || 'I';
  const fromTo =
    trip?.origin_landmark && trip?.destination_landmark
      ? `from ${trip.origin_landmark} to ${trip.destination_landmark}`
      : 'on a trip';

  const body = [
    `SafeCircles: ${who} just started a trip ${fromTo}.`,
    mapsUrl ? `Live location: ${mapsUrl}` : 'Location unavailable.',
    `Reply if you do not hear from ${who} on time.`,
  ].join(' ');

  return `sms:${recipients}?&body=${encodeURIComponent(body)}`;
}
