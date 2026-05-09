import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Persistent IndexedDB cache so trips/circles/messages stay readable while
// offline and writes queue + replay on reconnect. Multi-tab manager is
// required for PWAs because the installed app and a browser tab can be open
// simultaneously — single-tab manager crashes the second one.
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch (err) {
  // Falls back to in-memory cache when IndexedDB is unavailable
  // (private/incognito mode, some embedded webviews).
  // eslint-disable-next-line no-console
  console.warn('[firebase] persistent cache unavailable, using memory cache:', err.message);
  db = initializeFirestore(app, {});
}

export { db };

export const auth = getAuth(app);

// Survive PWA close/reopen and across reloads.
setPersistence(auth, browserLocalPersistence).catch(() => {
  /* incognito / disabled storage — non-fatal */
});

export default app;
