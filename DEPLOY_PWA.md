# SafeCircles — PWA Deployment Guide

Step-by-step deploy of SafeCircles as a fully-working installable PWA on Firebase Hosting, with offline app shell, Firestore offline persistence, and Web Push (FCM).

Repo state assumed: Firebase project `safecircles-d990c` already linked (see `.firebaserc`); `.env.local` has the `VITE_FIREBASE_*` keys; you have admin access to the Firebase Console.

---

## 1. Pre-flight

From the repo root:

```powershell
node -v        # must be 24.x (backend Cloud Functions target Node 24)
npm -v
firebase --version
```

If `firebase` is missing:

```powershell
npm install -g firebase-tools
firebase login
```

Confirm the project is the right one:

```powershell
firebase projects:list
firebase use safecircles-d990c
```

`firebase.json` already points hosting at `frontend/dist`, so no further wiring is needed.

---

## 2. Get the VAPID Web Push key (one-time)

Push notifications need a VAPID key pair from Firebase Cloud Messaging.

1. Open the Firebase Console → your project → **Project settings** (gear icon).
2. **Cloud Messaging** tab → **Web configuration** → **Web Push certificates** → **Generate key pair**.
3. Copy the **Key pair** value (starts with `B…`, ~88 chars).

Paste it into `.env.local` at the repo root:

```env
VITE_FIREBASE_VAPID_KEY=BPaste_the_VAPID_public_key_here
```

If you skip this step, the app still works — `initPushNotifications()` bails cleanly (`[notifications] VITE_FIREBASE_VAPID_KEY not set; push disabled.`) and only push is disabled.

---

## 3. (Optional but recommended) Replace stop-gap PWA icons

Right now `frontend/public/icons/` contains three copies of `hero-bg.png` (~800 KB each). PWA installs work, but Lighthouse will flag oversized icons.

Generate proper sizes from a 1024×1024 SafeCircles logo:

```powershell
npx pwa-asset-generator path/to/logo-1024.png frontend/public/icons --background "#0B132B" --opaque false
```

Or skip and ship as-is — purely a polish step.

---

## 4. Build

```powershell
npm install        # only if dependencies changed
npm run build
```

Expected output (last run produced these — yours will differ slightly):

```
dist/manifest.webmanifest                        0.79 kB
dist/index.html                                  1.35 kB
dist/firebase-messaging-sw.js                    2.15 kB
dist/assets/index-*.css                         83.51 kB
dist/sw.js                                      <Workbox SW>
dist/workbox-*.js                               <Workbox runtime>
PWA v1.3.0
mode      generateSW
precache  13 entries (~3.2 MiB)
```

Sanity checks before deploying:

```powershell
# 1. Verify FCM placeholders were substituted (should NOT print any matches)
Select-String -Path frontend\dist\firebase-messaging-sw.js -Pattern "__FIREBASE_"

# 2. Verify manifest has correct icons
Get-Content frontend\dist\manifest.webmanifest

# 3. Smoke-test the build locally
npm run preview
# Open http://localhost:4173 — DevTools → Application → Manifest, Service Workers
```

In Chrome DevTools while previewing:
- **Application → Manifest** — name, icons, start_url, theme_color all populated.
- **Application → Service Workers** — both `sw.js` and `firebase-messaging-sw.js` registered.
- **Application → Cache Storage** — `workbox-precache-v2`, `osm-tiles`, `cartocdn-tiles` populate as you navigate.
- **Lighthouse** → Progressive Web App audit should pass (warnings about icon source quality if you skipped step 3 are expected).

---

## 5. Deploy

```powershell
npm run deploy
```

This runs `npm run build && firebase deploy`, deploying:
- **Hosting** from `frontend/dist`
- **Firestore rules** from `firestore.rules`
- **Firestore indexes** from `firestore.indexes.json`
- **Storage rules** from `storage.rules`
- **Both Cloud Functions codebases** (`functions/` and `backend/`) — backend's predeploy lint hook runs first

Hosting-only redeploy (faster when you didn't touch rules/functions):

```powershell
npm run deploy:hosting
```

The CLI prints the live URL — usually `https://safecircles-d990c.web.app` and the firebaseapp.com mirror.

---

## 6. Post-deploy verification

Open the live URL in **Chrome on desktop** (best DevTools).

### 6.1 Install prompt
- DevTools → **Application → Manifest** — no errors.
- The address bar should show an install icon (⊕). Click it → app opens in a standalone window.
- On Android Chrome: tap menu → **Install app**.
- On iOS Safari: tap Share → **Add to Home Screen** (Safari has its own flow; web push only works after install on iOS 16.4+).

### 6.2 Service workers
- DevTools → **Application → Service Workers** — both registered:
  - `sw.js` — scope `/`
  - `firebase-messaging-sw.js` — scope `/firebase-cloud-messaging-push-scope`

### 6.3 Offline app shell
- DevTools → **Network** tab → check "Offline".
- Reload the page. App shell should load from precache. Routes resolve. Map tiles render from cache if previously visited.

### 6.4 Firestore offline persistence
- Online: sign in, open the dashboard, let trips load.
- Toggle DevTools → Network → **Offline**.
- Refresh — trips list still renders from IndexedDB cache.
- Try to create a trip — write queues. Toggle back online — write replays automatically.

### 6.5 Update flow
- Make a trivial change (e.g. bump a string in `index.html`), `npm run deploy:hosting`.
- On the live PWA, within ~1 minute a toast appears: **"New version available — Reload"**.
- Click Reload → new version loads.

### 6.6 Push notifications (if VAPID key set)
- Sign in. Browser prompts for notification permission. Grant.
- Inspect `users/<uid>` in Firestore Console — `fcmToken` field present.
- Firebase Console → **Cloud Messaging** → **Send your first message** → **Send test message** → paste the user's `fcmToken` → Send.
- A system notification should appear (background path: handled by `firebase-messaging-sw.js`).
- With the app foregrounded, send another test → toast appears in-page (foreground path: handled by `services/notifications.js`).

If `VITE_FIREBASE_VAPID_KEY` is unset, the console logs `[notifications] VITE_FIREBASE_VAPID_KEY not set; push disabled.` and the app works fully without push.

---

## 7. Follow-up: Cloud Function to actually send pushes

This guide collects FCM tokens. To **send** a push when a SafeCircle forms or a chat message arrives, you still need a Cloud Function. Sketch:

```js
// backend/sendCirclePush.js — TRIGGERS on safe_circles create
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

exports.notifyCircleFormed = onDocumentCreated('safe_circles/{circleId}', async (event) => {
  const circle = event.data.data();
  const memberIds = circle.member_ids || [];
  const userDocs = await Promise.all(
    memberIds.map((uid) => admin.firestore().doc(`users/${uid}`).get())
  );
  const tokens = userDocs.map((d) => d.data()?.fcmToken).filter(Boolean);
  if (!tokens.length) return;

  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: 'Your SafeCircle is ready',
      body: `${memberIds.length} verified members traveling together.`,
    },
    data: { url: `/circle/${event.params.circleId}` },
  });
});
```

Add similar triggers for `alerts/{alertId}` create and chat `safe_circles/{id}/messages/{msgId}` create. Wire into `backend/index.js` and deploy with `npm run deploy:functions`.

This is **not in the current build** — it's the next obvious task.

---

## 8. Common deploy issues

| Symptom | Cause | Fix |
|---|---|---|
| `firebase deploy` says "no project active" | Repo not linked | `firebase use safecircles-d990c` |
| Hosting deploy succeeds but site is blank | Service worker stuck on old precache | Hard refresh (Ctrl+Shift+R) once; new SW takes over |
| Install icon missing in browser | Manifest not served as JSON, wrong `start_url`, or insecure context | Open DevTools → Application → Manifest, read the error. Verify HTTPS. |
| Push notifications never arrive | VAPID key empty/wrong, browser denied permission, no Cloud Function sending them | Check Notification.permission; verify `users/<uid>.fcmToken` exists; send a test message from Firebase Console |
| `firebase-messaging-sw.js` returns 404 | File not in `frontend/dist/` | The `fcm-sw-templater` Vite plugin only runs on `vite build`, not `vite dev`. Run `npm run build` then redeploy. |
| Frames missing on landing page | `VITE_CLOUDINARY_FRAMES_BASE` URL doesn't match real Cloudinary public IDs | Open Network tab on `/`, confirm 200 for `scframes1/ezgif-frame-001.jpg` etc. |
| `npm run dev` slower than expected | Vite watcher pinning 100+ MB of static assets | Already mitigated via `server.watch.ignored` in `vite.config.js` — no action needed |

---

## 9. Re-deploy checklist (every release)

```powershell
# 1. Pull latest
git pull

# 2. Install if deps changed
npm install

# 3. Run tests + lint
npm test -- --run
npm run lint

# 4. Build & deploy
npm run deploy

# 5. Smoke test the live URL
#    - sign in, create a trip, mark reached safely
#    - check DevTools → Application → Service Workers
#    - check console for SW or FCM warnings
```

That's it. The PWA is live, installable, offline-capable, push-ready.
