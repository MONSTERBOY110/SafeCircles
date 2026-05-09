import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import app, { db, auth } from './firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let messagingInstance = null;
let foregroundUnsubscribe = null;

async function getMessagingSafely() {
  if (messagingInstance) return messagingInstance;
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;
  try {
    if (!(await isSupported())) return null;
  } catch {
    return null;
  }
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

/**
 * Idempotent push-notification setup. Safe to call after every sign-in.
 * - bails cleanly when VAPID key is missing, browser doesn't support FCM,
 *   permission is denied, or service workers are unavailable
 * - persists the FCM token to users/<uid>.fcmToken so a Cloud Function can
 *   later look it up to deliver pushes
 * - subscribes once to foreground messages, displaying them as a toast
 */
export async function initPushNotifications() {
  if (!VAPID_KEY) {
    // eslint-disable-next-line no-console
    console.info('[notifications] VITE_FIREBASE_VAPID_KEY not set; push disabled.');
    return null;
  }

  const messaging = await getMessagingSafely();
  if (!messaging) return null;

  if (Notification.permission === 'default') {
    const granted = await Notification.requestPermission();
    if (granted !== 'granted') return null;
  } else if (Notification.permission !== 'granted') {
    return null;
  }

  let registration;
  try {
    registration =
      (await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')) ||
      (await navigator.serviceWorker.register('/firebase-messaging-sw.js'));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[notifications] SW registration failed:', err.message);
    return null;
  }

  let token = null;
  try {
    token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[notifications] getToken failed:', err.message);
    return null;
  }

  if (!token) return null;

  if (auth.currentUser) {
    try {
      await setDoc(
        doc(db, 'users', auth.currentUser.uid),
        { fcmToken: token, fcmUpdatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[notifications] token persist failed:', err.message);
    }
  }

  if (foregroundUnsubscribe) foregroundUnsubscribe();
  foregroundUnsubscribe = onMessage(messaging, (payload) => {
    const n = payload.notification || payload.data || {};
    const text = n.title ? `${n.title}${n.body ? ': ' + n.body : ''}` : n.body || 'New update';
    toast(text);
  });

  return token;
}

/**
 * Request browser notification permission (legacy helper, still used elsewhere).
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
export function showLocalNotification(title, body, icon = '/icons/icon-192.png') {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body, icon });
  }
}

/**
 * Show an emergency notification with sound.
 */
export function showEmergencyNotification(message) {
  showLocalNotification('SafeCircles EMERGENCY', message);
}
