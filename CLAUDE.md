# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

The frontend (React/Vite app) lives under `frontend/`. The repo root keeps `package.json`, `node_modules/`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `.env.local`, and the two Cloud Functions codebases (`functions/`, `backend/`).

```
SafeCircles/
├── frontend/
│   ├── src/                        ← React app source
│   ├── public/                     ← static assets, FCM SW, PWA icons
│   ├── index.html
│   ├── vite.config.js              ← Vite + VitePWA + FCM-SW templater
│   ├── tailwind.config.js          ← absolute, slash-normalised content paths
│   ├── postcss.config.js           ← pins tailwindcss config explicitly
│   └── dist/                       ← `vite build` output, served by Firebase Hosting
├── functions/                      ← Cloud Functions codebase 'default'
├── backend/                        ← Cloud Functions codebase 'functions'
├── package.json                    ← single package.json, single node_modules
├── firebase.json                   ← hosting.public = "frontend/dist"
└── .env.local                      ← Vite reads via envDir: '..'
```

## Commands

All commands run from the repo root.

- `npm run dev` — Vite dev server on `http://localhost:3000` against `frontend/`. Heap is pinned to 8 GB via `cross-env NODE_OPTIONS=--max-old-space-size=8192` (Windows-safe).
- `npm run build` — production build to `frontend/dist/`. Vite emits `sw.js` (Workbox), `manifest.webmanifest`, `firebase-messaging-sw.js` (FCM, with API keys substituted at build time).
- `npm run preview` — serve the built bundle. Use this to test the PWA — the Workbox SW is intentionally disabled in `dev`.
- `npm run lint` — ESLint over `frontend/src/`.
- `npm run format` — Prettier write over `frontend/src/`.
- `npm test` — Vitest. Run a single test file with `npx vitest --root frontend run path/to/file.test.js`.
- `npm run deploy` — `npm run build && firebase deploy` (hosting + both functions codebases + rules).
- `npm run deploy:functions` / `npm run deploy:hosting` — partial deploys.

Cloud Functions live in their own npm package under `backend/` (and a mirror at `functions/`, see "Two functions codebases" below). From inside `backend/`:
- `npm run lint` — runs as `predeploy` hook for the `functions` codebase per `firebase.json`.
- `npm run serve` — Firebase emulator (functions only).
- The package targets **Node 24** (`backend/package.json` `engines.node`); local Node must match for emulator/deploy.

Firebase emulators (configured in `firebase.json`): auth `9099`, firestore `8080`, functions `5001`, storage `9199`, plus emulator UI.

A `.env.local` (at the repo root) with `VITE_FIREBASE_*` keys is required for the frontend to initialise Firebase (`frontend/src/services/firebase.js` reads `import.meta.env.VITE_FIREBASE_*`). Vite finds it via `envDir: '..'` in `frontend/vite.config.js`. Additional vars used by the PWA pipeline:

- `VITE_CLOUDINARY_FRAMES_BASE` — Cloudinary delivery base URL for landing-page scroll frames (e.g. `https://res.cloudinary.com/dbltkxnne/image/upload/f_auto,q_auto,w_1920/scframes`). Falls back to `/frames` if unset.
- `VITE_FIREBASE_VAPID_KEY` — Web Push public key from Firebase Console → Project Settings → Cloud Messaging. Leave empty to disable push gracefully.

### Phone testing via tunnel

`vite.config.js` reads `VITE_TUNNEL_MODE` from `.env.local`. When set, Vite's HMR client points at `wss://<page-host>:443` so HMR works through cloudflared / ngrok / localtunnel. The config also whitelists `.loca.lt`, `.ngrok-free.app`, `.ngrok.io`, `.trycloudflare.com` in `server.allowedHosts`.

Workflow: `npm run dev` in one terminal, `cloudflared tunnel --url http://localhost:3000` in another, open the `*.trycloudflare.com` URL on the phone. Geolocation requires HTTPS on non-localhost — the tunnel provides it. Comment out `VITE_TUNNEL_MODE=1` when developing on plain localhost (otherwise HMR tries `wss://localhost:443/` and fails harmlessly).

For production-style testing without a dev server: `npm run build && npm run preview -- --port 3000` then point the same tunnel at it. Localtunnel chokes on Vite dev mode's many small module requests (`ERR_NETWORK_CHANGED`, 502s); cloudflared and ngrok handle it fine.

## Architecture

SafeCircles is a React 18 + Vite SPA backed by Firebase (Auth + Firestore + Storage + Hosting + Functions). It forms ad-hoc "safe circles" of nearby travelers in real time.

### Frontend-driven matching (the load-bearing design choice)

The matching engine that pairs travelers into circles runs **client-side**, not in Cloud Functions. The canonical implementation is `findAndMatchTrips()` in `frontend/src/services/matching.js`. When a user creates a trip, the dashboard calls this function, which:

1. Reads all `trips` with `status == 'pending'` from Firestore.
2. Filters to trips whose **origin geohash prefix (first 4 chars)** matches the new trip's. Storage precision is 7 chars (~150m), but matching widens to a 4-char prefix (~5km cluster). The full 7-char hash is *not* used as the join key.
3. For each candidate, fetches the user doc and keeps only verified users (`isVerified === true` OR `verification_status === 'VERIFIED'` — both shapes exist in the wild).
4. Deduplicates by `userId`, sorts by reputation, takes top 4, creates a `safe_circles` doc, and batches the trip docs to `status: 'matched'` with the new `circle_id`.

Things to know when touching this path:
- **The README overstates the filter set.** The current code does *not* filter by `dest_geohash` or by `departure_window` overlap — only origin-prefix + verification. If you add those filters, update the README too.
- The frontend creates a `safe_circles` document with `status: 'forming'`, but `trips` are flipped to `status: 'matched'`. UIs/listeners check both — don't change one without the other.
- Cloud Functions in `backend/matchUsers.js` exist but are **not the source of truth**; the frontend path is what runs in production. Treat the function as a fallback / future server-side path, not a mirror.
- `listenToTrip` in `frontend/src/services/matching.js` uses CommonJS `require('firebase/firestore')` inside an ESM module — it will throw if called. Prefer building listeners with the already-imported `onSnapshot`/`doc` rather than reusing this helper.

### Per-user trip completion (the other load-bearing flow)

"Mark as Reached Safely" is **per-member**, not whole-circle. The handler in `CirclePage.jsx` (`handleCompleteTrip`) does, in one batch:

1. Queries `trips` for `where('circle_id', '==', circleId)` AND `where('userId', '==', currentUser.uid)` — note the field is `userId`, NOT `user_id` (an earlier bug used `user_id` and silently no-op'd).
2. Marks only that user's trip(s) `status: 'completed'` + `completedAt: serverTimestamp()`.
3. `arrayUnion(currentUser.uid)` into `safe_circles.reachedBy`.
4. Bumps only the current user's `reputation_score` by 1.

Then in a separate read+write (Firestore batches don't support reads): re-reads the circle, and if `reachedBy.length >= member_ids.length`, flips `safe_circles.status` to `'completed'` and writes a `trip_logs` entry. The CirclePage `safe_circles` `onSnapshot` listener auto-redirects ANY viewer to `/dashboard` when `status === 'completed'` — harmless because the user marking themselves reached has already navigated away, and the last-to-reach person triggers the flip.

The button gates itself: if `circle.reachedBy?.includes(currentUser.uid)`, it shows "Already Marked Reached" and is disabled. Confirmation is a styled in-app modal (`showCompleteConfirm`), not `window.confirm` — the project deliberately avoids browser-native dialogs.

Dashboard's trip-create handler navigates to `/trips` after `findAndMatchTrips` resolves, so users land where they can watch pending → matched live (TripsPage shows pending and matched in active sections, plus a "Past Trips" section of the 5 most recent completed trips sorted client-side by `completedAt` desc).

### Two functions codebases

`firebase.json` declares two Functions codebases:
- `default` → `functions/`
- `functions` (yes, the codebase is *named* "functions") → `backend/`, with `predeploy: npm --prefix backend run lint`.

`backend/` and `functions/` currently contain copies of the same files (`matchUsers.js`, `completeTrip.js`, `reportIncident.js`, `cleanupExpiredTrips.js`, `index.js`). When changing a Cloud Function, decide whether you need to update both directories or consolidate first — drift between them will silently deploy stale code under one codebase.

### Routing / app shell

`frontend/src/App.jsx` defines all routes inside `<AuthProvider>`. Protected pages are wrapped in `ProtectedRoute` (`frontend/src/components/Auth/`). Both `/circle` and `/circle/:circleId` resolve to `CirclePage` — circle-less navigation is supported.

`frontend/src/context/`:
- `AuthContext.jsx` — Firebase Auth user + profile state. The hook `useAuth` (`frontend/src/hooks/useAuth.js`) is the public read API.
- `AppContext.jsx` — global app state.
- `VerificationContext.jsx` — multi-step verification progress state.

### Verification flow

`frontend/src/components/Verification/VerificationFlow.jsx` orchestrates three steps that must all pass before a user is matchable:
1. `FaceDetection.jsx` — MediaPipe Face Mesh loaded **same-origin** from `frontend/public/mediapipe/face_mesh/` (committed runtime assets, ~16MB total). Was previously loaded from jsdelivr's CDN, but the SIMD WASM `.data` bundle threw `Cannot read properties of undefined (reading 'buffer')` inside Emscripten on some browser/version combos. Same-origin assets sidestep the issue. `VoiceVerification.jsx` uses the same path. Thresholds in `utils/faceValidation.js` and `utils/constants.js` (`VERIFICATION.FACE_CENTER_MIN/MAX`).
2. `HeadMovement.jsx` — liveness via head rotations.
3. `KycVerification.jsx` — calls a KYC provider via `frontend/src/services/kycProvider.js` to fetch verified gender. Replaced the voice step. See "Identity verification is KYC-based" below.

Verification writes set `verification_status: 'VERIFIED'` (and/or `isVerified: true`) on the `users` doc. The canonical OR-check (`userData?.isVerified === true || userData?.verification_status === 'VERIFIED'`) lives in three places: `AuthContext.jsx` (the exposed `isVerified` flag), `services/matching.js` `findAndMatchTrips` (filtering candidates), and `services/matching.js` `getCircleMembers` (per-member badge). All three must stay in sync if the schema changes.

`AuthContext.jsx` subscribes to the user's profile doc with `onSnapshot` (not a one-shot `getDoc`) — manual Firestore edits to `isVerified` propagate live without re-login. Components consuming `useAuth().isVerified` get the value reactively.

**Identity verification: face + head + voice (Silero VAD + CREPE).** Step 1 (`FaceDetection.jsx`) and Step 2 (`HeadMovement.jsx`) prove the user is a real live person via MediaPipe Face Mesh. Step 3 (`VoiceVerification.jsx`) gender-gates via voice analysis using a state-of-the-art pitch pipeline:

- **Silero VAD** (`@ricky0123/vad-web`, ONNX in browser) filters the recorded audio to speech-only segments before pitch analysis. Background noise / silence / breath frames are discarded — they would otherwise corrupt pitch estimates. Self-hosted ONNX + ORT WASM in `frontend/public/vad/`.
- **CREPE** (TFJS, model files self-hosted in `frontend/public/crepe/`) is the deep-learning pitch tracker from `marl/crepe`. Runs the canonical algorithm: 1024-sample windows hopped 160 samples (10 ms), zero-mean / unit-std normalization, 360-bin sigmoid activation, weighted local average of 9 bins around argmax → cents → Hz. Confidence floor 0.5 per frame.
- **Decision**: `evaluateVoiceConfidence` in `utils/voiceVerification.js`. Pitch hard-gated to `[BORDERLINE_FEMALE_PITCH_MIN, BORDERLINE_FEMALE_PITCH_MAX]` (140–280 Hz). Pitch-confidence floor `MIN_PITCH_CONFIDENCE = 0.4`. Reasons are mutually exclusive: "Could not detect voice clearly..." vs "Voice pitch is outside the expected range...".
- **Fallback**: if `frontend/public/crepe/model.json` fails to load, `detectPitch` falls back to **Pitchy** (proper YIN, already installed) on the same VAD-cleaned PCM. App still works; accuracy degrades from ~94% to ~88%. Console warns `[pitchDetection] CREPE model unavailable; falling back to Pitchy.`

`detectPitch` is **async** (VAD + CREPE inference are both async). Returns `{ frequency, confidence, frameCount, validFrames, vadFrames, model }` where `model` is `'crepe' | 'pitchy-fallback' | 'none'`.

**Honest accuracy ceiling**: ~92–95% on adult voices with this pipeline. Adult male/female pitch ranges genuinely overlap in the 150–180 Hz band; no model can resolve that ambiguity. Documented failure modes:
- Women with naturally low F0 (~5% of adult women) may be falsely rejected
- Falsetto-singing men may be falsely accepted
- Hormonal conditions, throat surgery, illness can shift pitch outside the gate
- Children's voices (>280 Hz) are also rejected via the upper bound

For production women-only services, voice verification should be ONE signal; ID-based KYC (DigiLocker / aggregator) is the canonical source of gender. A DigiLocker integration was prototyped earlier in this codebase and reverted — the path is in git history.

### Setup (one-time, already done in this repo — for re-creation)

1. **Silero VAD assets** (`frontend/public/vad/`):
   ```bash
   cp node_modules/@ricky0123/vad-web/dist/silero_vad_legacy.onnx frontend/public/vad/
   cp node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx frontend/public/vad/
   cp node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js frontend/public/vad/
   cp node_modules/onnxruntime-web/dist/*.wasm frontend/public/vad/
   ```
2. **CREPE TFJS model** (`frontend/public/crepe/`) — fetched verbatim from the official `marl/crepe` GitHub Pages demo:
   ```bash
   curl -o frontend/public/crepe/model.json https://marl.github.io/crepe/model/model.json
   for i in {1..13}; do
     curl -o "frontend/public/crepe/group${i}-shard1of1" \
          "https://marl.github.io/crepe/model/group${i}-shard1of1"
   done
   ```
   Total ~2 MB. This is the canonical TFJS model the user pasted reference inference code for.

`detectPitch` unit tests exist as `pitchDetection.test.js` covering the unchanged RMS/VAD helpers; the full Silero+CREPE pipeline is exercised via manual browser testing (TFJS + WebAssembly don't run cleanly in jsdom).

`AuthContext.signup()` no longer hardcodes `gender: 'female'` — that field is unused by the voice flow. The `STEPS` array in `VerificationFlow.jsx` is `['face', 'head', 'voice', 'complete']`.

### Firestore data model

Collections used by the app (see README "Firestore Collections" for full shapes):
- `users` — profile + verification + reputation (`reputation_score` *and* `reputation` are both read by matching code; prefer `reputation_score`).
- `trips` — origin/dest landmarks, `origin_coords`/`dest_coords`, `origin_geohash`/`dest_geohash` (precision 7), `departure_window`, `status` ∈ `pending|matched|active|completed`, `circle_id`, `expires_at` (90 min TTL — see `MATCHING.TRIP_TTL_MINUTES`).
- `safe_circles` — `member_ids[]`, `meeting_point`, `dest_coords`, `route_summary`, `reachedBy[]` (UIDs of members who have marked themselves reached safely), `status` ∈ `forming|matched|completed`.
- `live_locations` — geohash precision 6 (~600m) for privacy. Updated every ~10s by `services/locationTracking.js`.
- `alerts`, `safety_pings`, `trip_logs` — emergency events, status pings, completed-trip history.

`firestore.rules` enforces per-collection rules and **per-field immutability** on the verification fields:
- `users/{userId}` — readable by any authed user; writable only by the user themselves (`request.auth.uid == userId`).
- `gender` and `kycProvider` are locked after first set (used by the KYC flow).
- `isVerified` can only transition `false` → `true`; `verification_status` can only transition `null`/`PENDING` → `VERIFIED`. No path back.
- Other collections (`trips`, `safe_circles` and its `messages` subcollection, `live_locations`, `alerts`, `safety_pings`, `trip_logs`) require auth but are otherwise unconstrained — application code is trusted to scope writes.
- No client-side deletes on `users` (admin-only).

Why explicit per-collection rules instead of a `/{document=**}` catch-all: in Firestore rules, requests are allowed if **any** matching rule grants access. A catch-all that allows write would override the more-specific `users/{userId}` lock and let users freely change their `gender`. Listing collections explicitly avoids that overlap.

Deploy with `firebase deploy --only firestore:rules` after editing — file edits alone don't update the live project.

### Geohashing

`frontend/src/utils/geohash.js` is a hand-rolled base-32 geohash encoder/decoder. The `ngeohash` npm package is also a dependency — check which one a given file uses before changing precision constants. Storage precision = 7; matching prefix length = 4; live-location precision = 6. These are tuned together; changing one without the others will break the matching radius or the privacy guarantee.

### Build chunking

`frontend/vite.config.js` splits five large vendor chunks: `mediapipe`, `firebase`, `leaflet`, `tfjs`, `vad`. `firebase` includes `firebase/messaging` so the FCM client is in the same lazy chunk as Auth/Firestore. If you add a heavy SDK that should be lazy-loaded, extend `manualChunks` rather than letting it land in the main bundle.

### Landing-page scroll frames (Cloudinary)

The cinematic landing page (`frontend/src/pages/Home.jsx`) plays three image sequences (scframes1: 240 frames, scframes2: 170, scframes3: 240) via `ScrollFrameSequence.jsx`. Frames are hosted on **Cloudinary** (cloud `dbltkxnne`) under `scframes/scframes<N>/ezgif-frame-NNN.jpg` (note the trailing `s` — `scframes1`, not `scframe1`), served with `f_auto,q_auto,w_1920` so browsers get WebP/AVIF (~30 KB/frame instead of ~100 KB JPG). The base URL lives in `VITE_CLOUDINARY_FRAMES_BASE`. If unset, the component falls back to `/frames` (only useful if you restore a local `frontend/public/frames/` directory for offline dev).

`ScrollFrameSequence.jsx` gates its preload behind `IntersectionObserver` (`rootMargin: '100% 0px 100% 0px'`) — each section only fetches its frames when within ~1 viewport of the screen. Without this, all 650 frames would decode simultaneously on first paint and OOM the tab. Workbox runtime-caches `res.cloudinary.com/dbltkxnne/*` with a `CacheFirst` strategy, so returning visitors hit zero CDN bandwidth after the first scroll.

### PWA — installable + offline + push

The app is a Workbox-based PWA via `vite-plugin-pwa` and a separately-registered Firebase Cloud Messaging service worker.

**Two service workers, two scopes** (intentional — they coexist by browser design):
- `dist/sw.js` (Workbox) at scope `/` — precaches the app shell, runtime-caches fonts, OSM/CARTO tiles, Cloudinary frames, and the heavy CREPE/VAD/MediaPipe assets. Firebase REST endpoints are explicitly `NetworkOnly`; the Firebase SDK manages its own IndexedDB cache.
- `dist/firebase-messaging-sw.js` at scope `/firebase-cloud-messaging-push-scope` (auto-set by FCM) — handles `onBackgroundMessage` and `notificationclick`. Firebase init values come from `__FIREBASE_*__` placeholders that the `fcm-sw-templater` Vite plugin substitutes at build time, reading `.env.local`. The SW source in `frontend/public/firebase-messaging-sw.js` keeps the placeholders so dev-served raw never leaks anything; the build-time substitution is the only way these get filled.

**Workbox excludes** (configured in `frontend/vite.config.js`'s `VitePWA` block): `frames/`, `crepe/`, `vad/`, `mediapipe/`, and `firebase-messaging-sw.js` are removed from precache; large media/model assets go through runtime cache only when actually fetched. `maximumFileSizeToCacheInBytes: 5 * 1024 * 1024` is a defensive cap.

**Firestore offline persistence**: `frontend/src/services/firebase.js` uses `initializeFirestore(...)` with `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`. Multi-tab manager is required for PWAs because the installed app and a browser tab can be open simultaneously. Falls back to in-memory cache automatically in private/incognito mode. Existing `onSnapshot` listeners keep emitting from cache while offline; writes queue and replay on reconnect.

**Push notifications (FCM)**: `frontend/src/services/notifications.js` exposes `initPushNotifications()` (called from `AuthContext` after sign-in). It bails cleanly if `VITE_FIREBASE_VAPID_KEY` is unset, the browser doesn't support FCM (notably iOS Safari without "Add to Home Screen"), or the user denies permission. On success, the FCM token is persisted to `users/<uid>.fcmToken` (no Firestore rule change needed — users can write any unlocked field on their own doc). Foreground messages render as `react-hot-toast`; background messages go through the FCM SW's `showNotification`. Sending pushes still requires a Cloud Function (in `backend/` or `functions/`) that triggers on `safe_circles` create / `alerts` create / `messages` create and posts to FCM with each member's stored token — that follow-up is documented but not yet implemented.

**One-time setup** (per environment):
1. Firebase Console → Project Settings → Cloud Messaging → generate a Web Push certificate (VAPID key pair). Public side goes into `.env.local` as `VITE_FIREBASE_VAPID_KEY=…`.
2. PWA icons: stop-gap copies of `hero-bg.png` are in `frontend/public/icons/` (`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`). For production, run `npx pwa-asset-generator <1024×1024-logo>.png frontend/public/icons --background "#0B132B"`.

**Update flow**: `vite-plugin-pwa` is configured with `registerType: 'autoUpdate'`. `frontend/src/components/PwaUpdatePrompt.jsx` (mounted once in `App.jsx`) listens for new SW availability via `useRegisterSW` from `virtual:pwa-register/react` and shows a toast with a Reload button.

**Dev caveats**:
- `devOptions.enabled: false` keeps the Workbox SW off during `npm run dev` so HMR isn't confused. Test the PWA via `npm run preview` after a build.
- The FCM SW (`firebase-messaging-sw.js`) is served raw in dev with placeholders intact — `firebase.initializeApp` will fail inside the SW. Foreground messaging via the SDK still works; only background pushes need the build-substituted file.

### Emergency / SOS architecture

The CirclePage's emergency grid is **two cards only**: Share Location + Emergency Call. Alert Circle and Fake Call were intentionally removed; do not re-add them. Share Location is a single handler in `frontend/src/pages/CirclePage.jsx` that pulls current GPS, builds a `https://www.google.com/maps?q=<lat>,<lng>` URL, and opens the native Android share sheet (`navigator.share`) → fallback to clipboard → fallback to `wa.me/?text=`. Emergency Call modal still has Police 100 + Women's Helpline 1090.

The **in-app SOS** is a global FAB (`frontend/src/components/Emergency/SosButton.jsx`) mounted by `SosArmer.jsx`, which itself sits inside `<AuthProvider>` in `App.jsx`. The armer subscribes to `trips where userId == uid` and shows the FAB whenever any trip is in `pending`/`matched`/`active`. Tap-and-hold for 1.5 s fires: writes `alerts/{id} { type: 'sos', triggeredBy, triggeredByName, circleId, location, timestamp }`, sets `users/<uid>.sos_active=true` + `sos_started_at`, then opens a prefilled `sms:` URI to the user's saved personal contacts. 20 s cooldown after fire. Releasing before 1.5 s cancels with no side effects.

**Personal emergency contacts** live on `users/<uid>.emergency_contacts` as `[{name, phone}]`, max 5, edited from the Profile page (`EmergencyContacts.jsx`). The field is unlocked in `firestore.rules` (only `gender`/`kycProvider`/`isVerified`/`verification_status` are locked). The SMS opens via `buildSosSmsHref()` in `frontend/src/utils/sos.js` — comma-separated recipients work on Android Chrome / Samsung Internet; iOS Safari uses ampersand instead and is currently a known limitation.

**OS handoff for true background SOS**: a PWA cannot intercept the hardware power button or send SMS without a user tap — both are OS-privileged. The `AndroidSosSetupCard.jsx` on Profile guides the user to enable Android's built-in **Settings → Safety & Emergency → Emergency SOS** (power-button × 5 / 3 → SMS+location to phone-saved contacts), which is literally the "background power-button SOS" feature. The card's deep-link button is best-effort (Android intent filters reject most web-initiated Settings navigations); the on-screen steps are the real instructions.

The `alerts` collection now has a `type: 'sos'` shape. Sending an FCM push to circle members on `alerts/{id}` create with `type === 'sos'` is a Cloud Function follow-up (sketched in `DEPLOY_PWA.md` step 7). The frontend writes the doc; the function fans out the push.

**Trip-start auto-notify** (`frontend/src/components/Emergency/TripStartNotifier.jsx`, mounted in `App.jsx` next to `SosArmer`) subscribes to the user's trips and, on every `pending → matched` transition (or any matched trip seen on app load), surfaces a persistent `react-hot-toast` with **Notify** and **Skip** buttons. Tapping **Notify** fetches GPS, builds a `sms:` URI via `buildTripStartSmsHref()` (sibling to `buildSosSmsHref` in `utils/sos.js`) prefilled with the user's saved personal contacts as recipients and a body of `SafeCircles: <name> just started a trip from <origin> to <destination>. Live location: <Google Maps URL>. Reply if you do not hear from <name> on time.`. The user taps Send in their messaging app — same gesture-required `sms:` mechanism as SOS. **Idempotency**: per-trip flag in `localStorage` under key `safecircles:trip_sms_sent:<tripId>`, set on both Notify and Skip so the toast never re-shows for the same trip on the same device. The listener also covers the *passive-match* case (a user whose pending trip got matched by someone else creating later) — without it, only the active creator's session would see the prompt. If the user has zero saved emergency contacts, a softer "add contacts on Profile" toast is shown instead. There are intentionally two near-identical Firestore listeners on the user's trips (`SosArmer` + `TripStartNotifier`); the SDK shares the network subscription so cost is one read stream, not two.

### Tailwind config quirk

`frontend/postcss.config.js` explicitly pins `tailwindcss: { config: <absolute-path-to-tailwind.config.js> }` because the build runs from the repo root, so PostCSS's auto-discovery doesn't find `frontend/tailwind.config.js`. The Tailwind config itself uses `path.resolve(__dirname, ...)` then forward-slash normalisation — backslashes are escape characters in glob syntax, so a raw `D:\…\src\**\*.{js,jsx}` pattern fails to match anything on Windows. Don't simplify either of these without testing on Windows.

## Conventions worth knowing

- Field names are mixed **snake_case** (Firestore docs: `member_ids`, `origin_geohash`, `circle_id`, `verification_status`) and **camelCase** (JS-only fields: `userId`, `circleType`). Match the surrounding code — don't normalize aggressively.
- Toasts are via `react-hot-toast`; emergency phone numbers are India defaults in `EMERGENCY_CONTACTS` (`utils/constants.js`).
- The README is detailed and mostly accurate, but the matching-filter discrepancy noted above is the kind of drift to watch for. When in doubt, read `frontend/src/services/matching.js` — that's what actually runs.
- **Dashboard input panel** (`frontend/src/pages/Dashboard.jsx`) follows an Ola/Uber pattern: focusing source or destination toggles `activeField`, which swaps the bottom map for an in-place suggestion panel ("Use Current Location" → reverse-geocode, recent picks from `localStorage`, live Nominatim search). When extending the form, render any new affordances inside the panel rather than as inline dropdowns under the inputs.
- **Dashboard GPS marker** uses `<CircleMarker>` (pixel-radius dot) plus a soft `<Circle>` ring sized by `position.coords.accuracy` (clamped 30m–50km) — NOT the default `<Marker>`, because Leaflet's default marker icon isn't bundled by Vite. The dot is fed by `navigator.geolocation.watchPosition` (cleaned up on unmount). When `accuracy > 1000m` an overlay warns the user that the fix is approximate — desktop browsers fall back to Wi-Fi/IP geolocation which is intrinsically rough; only phones return tight (5–30m) GPS fixes. `CircleMap.jsx` keeps a `L.Icon.Default.mergeOptions` icon-CDN fix for components that need actual `<Marker>` pins.
- **Leaflet CSS** is imported once globally in `frontend/src/index.css` (`@import "leaflet/dist/leaflet.css"`). Don't add per-component imports — they used to exist in `CircleMap`/`LiveMap`/`ComfortMap` and were removed as no-op duplicates.
- **Reverse geocoding** is a one-off inline call to `https://nominatim.openstreetmap.org/reverse` in Dashboard. If reverse-geocoding spreads beyond Dashboard, factor it into `frontend/src/services/nominatim.js` and add a per-IP rate-limit note.
- **Header has no centre title.** `frontend/src/components/Layout/Header.jsx` renders `[brand or back-button] [spacer] [theme toggle]` — no page-name title. Don't add a `title` prop or re-introduce the `topbar-center` block; pages are responsible for their own headings inside the page body.
