/* eslint-disable no-undef */
// SafeCircles — Firebase Cloud Messaging service worker.
// __FIREBASE_*__ placeholders are substituted at build time by the
// fcm-sw-templater Vite plugin. In dev (no build), they remain as literals
// and FCM init will fail silently — foreground messaging still works via
// the regular SDK; only background pushes need this SW.

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

try {
  firebase.initializeApp({
    apiKey: '__FIREBASE_API_KEY__',
    authDomain: '__FIREBASE_AUTH_DOMAIN__',
    projectId: '__FIREBASE_PROJECT_ID__',
    storageBucket: '__FIREBASE_STORAGE_BUCKET__',
    messagingSenderId: '__FIREBASE_MESSAGING_SENDER_ID__',
    appId: '__FIREBASE_APP_ID__',
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const data = payload.notification || payload.data || {};
    const title = data.title || 'SafeCircles';
    const body = data.body || '';
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: payload.data || {},
    });
  });
} catch (err) {
  // In dev or when placeholders aren't substituted, init fails — that's fine.
  // Background messaging just won't work; foreground via the SDK still does.
  // eslint-disable-next-line no-console
  console.warn('[fcm-sw] init failed:', err && err.message);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientsArr) => {
        for (const client of clientsArr) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(url);
            return;
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
