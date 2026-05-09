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
