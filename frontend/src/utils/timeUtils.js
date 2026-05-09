/**
 * Time utility functions for SafeCircles.
 */

/**
 * Format a Date or Firestore Timestamp to a human-readable time string (e.g., "8:30 PM").
 */
export function formatTime(date) {
  if (!date) return '';
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format a Date to a date string (e.g., "Mar 22, 2026").
 */
export function formatDate(date) {
  if (!date) return '';
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Check if two time windows overlap.
 * @param {{ start: Date, end: Date }} window1
 * @param {{ start: Date, end: Date }} window2
 */
export function doWindowsOverlap(window1, window2) {
  const s1 = window1.start instanceof Date ? window1.start : window1.start.toDate();
  const e1 = window1.end instanceof Date ? window1.end : window1.end.toDate();
  const s2 = window2.start instanceof Date ? window2.start : window2.start.toDate();
  const e2 = window2.end instanceof Date ? window2.end : window2.end.toDate();
  return !(e1 < s2 || s1 > e2);
}

/**
 * Return a relative time string like "2 minutes ago".
 */
export function timeAgo(date) {
  if (!date) return '';
  const d = date.toDate ? date.toDate() : new Date(date);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000); // seconds

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return formatDate(date);
}

/**
 * Add minutes to a date.
 */
export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}
