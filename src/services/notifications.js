/**
 * Request browser notification permission.
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return false;
  }
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * Show a local browser notification.
 */
export function showLocalNotification(title, body, icon = '/images/logo.png') {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon });
  }
}

/**
 * Show an emergency notification with sound.
 */
export function showEmergencyNotification(message) {
  showLocalNotification('🚨 SafeCircles EMERGENCY', message);
}
