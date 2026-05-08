# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root unless noted.

- `npm run dev` — Vite dev server on `http://localhost:3000` (port pinned in `vite.config.js`).
- `npm run build` — production build to `dist/` (consumed by Firebase Hosting).
- `npm run preview` — serve the built bundle locally.
- `npm run lint` — ESLint over `src/`.
- `npm run format` — Prettier write over `src/`.
- `npm test` — Vitest. Run a single test file with `npx vitest run path/to/file.test.js`; watch a single file with `npx vitest path/to/file.test.js`.
- `npm run deploy` — `npm run build && firebase deploy` (hosting + both functions codebases + rules).
- `npm run deploy:functions` / `npm run deploy:hosting` — partial deploys.

Cloud Functions live in their own npm package under `backend/` (and a mirror at `functions/`, see "Two functions codebases" below). From inside `backend/`:
- `npm run lint` — runs as `predeploy` hook for the `functions` codebase per `firebase.json`.
- `npm run serve` — Firebase emulator (functions only).
- The package targets **Node 24** (`backend/package.json` `engines.node`); local Node must match for emulator/deploy.

Firebase emulators (configured in `firebase.json`): auth `9099`, firestore `8080`, functions `5001`, storage `9199`, plus emulator UI.

A `.env.local` with `VITE_FIREBASE_*` keys is required for the frontend to initialize Firebase (`src/services/firebase.js` reads `import.meta.env.VITE_FIREBASE_*`).

### Phone testing via tunnel

`vite.config.js` reads `VITE_TUNNEL_MODE` from `.env.local`. When set, Vite's HMR client points at `wss://<page-host>:443` so HMR works through cloudflared / ngrok / localtunnel. The config also whitelists `.loca.lt`, `.ngrok-free.app`, `.ngrok.io`, `.trycloudflare.com` in `server.allowedHosts`.

Workflow: `npm run dev` in one terminal, `cloudflared tunnel --url http://localhost:3000` in another, open the `*.trycloudflare.com` URL on the phone. Geolocation requires HTTPS on non-localhost — the tunnel provides it. Comment out `VITE_TUNNEL_MODE=1` when developing on plain localhost (otherwise HMR tries `wss://localhost:443/` and fails harmlessly).

For production-style testing without a dev server: `npm run build && npm run preview -- --port 3000` then point the same tunnel at it. Localtunnel chokes on Vite dev mode's many small module requests (`ERR_NETWORK_CHANGED`, 502s); cloudflared and ngrok handle it fine.

## Architecture

SafeCircles is a React 18 + Vite SPA backed by Firebase (Auth + Firestore + Storage + Hosting + Functions). It forms ad-hoc "safe circles" of nearby travelers in real time.

### Frontend-driven matching (the load-bearing design choice)

The matching engine that pairs travelers into circles runs **client-side**, not in Cloud Functions. The canonical implementation is `findAndMatchTrips()` in `src/services/matching.js`. When a user creates a trip, the dashboard calls this function, which:

1. Reads all `trips` with `status == 'pending'` from Firestore.
2. Filters to trips whose **origin geohash prefix (first 4 chars)** matches the new trip's. Storage precision is 7 chars (~150m), but matching widens to a 4-char prefix (~5km cluster). The full 7-char hash is *not* used as the join key.
3. **NEW: Also filters by destination geohash prefix (first 4 chars)** to ensure travelers are going to overlapping destinations.
4. **NEW: Checks departure time window overlap** (within 30-minute tolerance) to ensure travelers can depart together.
5. **NEW: Calculates path overlap score** using haversine distance between trip origins and destinations. A score of 100 means both origin and destination are within 5km of the new trip; partial overlap (30 points) if only one endpoint matches.
6. For each candidate, fetches the user doc and keeps only verified users (`isVerified === true` OR `verification_status === 'VERIFIED'` — both shapes exist in the wild).
7. Deduplicates by `userId`, sorts by **reputation first, then by path overlap score**, takes up to **10 matches** (supporting circles of 2–11 total members), creates a `safe_circles` doc, and batches the trip docs to `status: 'matched'` with the new `circle_id`.

Things to know when touching this path:
- The matching now **does filter by `dest_geohash`, `departure_window`, and path overlap**. These are essential for forming coherent multi-person circles with overlapping routes.
- Circle size can now be 2–11 members (up to 10 matches + the creator). UX should reflect this flexibility.
- The frontend creates a `safe_circles` document with `status: 'forming'`, but `trips` are flipped to `status: 'matched'`. UIs/listeners check both — don't change one without the other.
- Cloud Functions in `backend/matchUsers.js` exist but are **not the source of truth**; the frontend path is what runs in production. Treat the function as a fallback / future server-side path, not a mirror.
- `listenToTrip` in `matching.js` uses CommonJS `require('firebase/firestore')` inside an ESM module — it will throw if called. Prefer building listeners with the already-imported `onSnapshot`/`doc` rather than reusing this helper.
- Path overlap scoring uses `calculateDistance()` from `utils/haversine.js`. If you change distance thresholds (currently 5km for origin and destination), test impact on match rates in dense vs sparse regions.

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

`src/App.jsx` defines all routes inside `<AuthProvider>`. Protected pages are wrapped in `ProtectedRoute` (`src/components/Auth/`). Both `/circle` and `/circle/:circleId` resolve to `CirclePage` — circle-less navigation is supported.

`src/context/`:
- `AuthContext.jsx` — Firebase Auth user + profile state. The hook `useAuth` (`src/hooks/useAuth.js`) is the public read API.
- `AppContext.jsx` — global app state.
- `VerificationContext.jsx` — multi-step verification progress state.

### Verification flow

`src/components/Verification/VerificationFlow.jsx` orchestrates three steps that must all pass before a user is matchable:
1. `FaceDetection.jsx` — MediaPipe Face Mesh loaded **same-origin** from `public/mediapipe/face_mesh/` (committed runtime assets, ~16MB total). Was previously loaded from jsdelivr's CDN, but the SIMD WASM `.data` bundle threw `Cannot read properties of undefined (reading 'buffer')` inside Emscripten on some browser/version combos. Same-origin assets sidestep the issue. `VoiceVerification.jsx` uses the same path. Thresholds in `utils/faceValidation.js` and `utils/constants.js` (`VERIFICATION.FACE_CENTER_MIN/MAX`).
2. `HeadMovement.jsx` — liveness via head rotations.
3. `KycVerification.jsx` — calls a KYC provider via `src/services/kycProvider.js` to fetch verified gender. Replaced the voice step. See "Identity verification is KYC-based" below.

Verification writes set `verification_status: 'VERIFIED'` (and/or `isVerified: true`) on the `users` doc. The canonical OR-check (`userData?.isVerified === true || userData?.verification_status === 'VERIFIED'`) lives in three places: `AuthContext.jsx` (the exposed `isVerified` flag), `services/matching.js` `findAndMatchTrips` (filtering candidates), and `services/matching.js` `getCircleMembers` (per-member badge). All three must stay in sync if the schema changes.

`AuthContext.jsx` subscribes to the user's profile doc with `onSnapshot` (not a one-shot `getDoc`) — manual Firestore edits to `isVerified` propagate live without re-login. Components consuming `useAuth().isVerified` get the value reactively.

**Identity verification: face + head + voice (Silero VAD + CREPE).** Step 1 (`FaceDetection.jsx`) and Step 2 (`HeadMovement.jsx`) prove the user is a real live person via MediaPipe Face Mesh. Step 3 (`VoiceVerification.jsx`) gender-gates via voice analysis using a state-of-the-art pitch pipeline:

- **Silero VAD** (`@ricky0123/vad-web`, ONNX in browser) filters the recorded audio to speech-only segments before pitch analysis. Background noise / silence / breath frames are discarded — they would otherwise corrupt pitch estimates. Self-hosted ONNX + ORT WASM in `public/vad/`.
- **CREPE** (TFJS, model files self-hosted in `public/crepe/`) is the deep-learning pitch tracker from `marl/crepe`. Runs the canonical algorithm: 1024-sample windows hopped 160 samples (10 ms), zero-mean / unit-std normalization, 360-bin sigmoid activation, weighted local average of 9 bins around argmax → cents → Hz. Confidence floor 0.5 per frame.
- **Decision**: `evaluateVoiceConfidence` in `utils/voiceVerification.js`. Pitch hard-gated to `[BORDERLINE_FEMALE_PITCH_MIN, BORDERLINE_FEMALE_PITCH_MAX]` (140–280 Hz). Pitch-confidence floor `MIN_PITCH_CONFIDENCE = 0.4`. Reasons are mutually exclusive: "Could not detect voice clearly..." vs "Voice pitch is outside the expected range...".
- **Fallback**: if `public/crepe/model.json` fails to load, `detectPitch` falls back to **Pitchy** (proper YIN, already installed) on the same VAD-cleaned PCM. App still works; accuracy degrades from ~94% to ~88%. Console warns `[pitchDetection] CREPE model unavailable; falling back to Pitchy.`

`detectPitch` is **async** (VAD + CREPE inference are both async). Returns `{ frequency, confidence, frameCount, validFrames, vadFrames, model }` where `model` is `'crepe' | 'pitchy-fallback' | 'none'`.

**Honest accuracy ceiling**: ~92–95% on adult voices with this pipeline. Adult male/female pitch ranges genuinely overlap in the 150–180 Hz band; no model can resolve that ambiguity. Documented failure modes:
- Women with naturally low F0 (~5% of adult women) may be falsely rejected
- Falsetto-singing men may be falsely accepted
- Hormonal conditions, throat surgery, illness can shift pitch outside the gate
- Children's voices (>280 Hz) are also rejected via the upper bound

For production women-only services, voice verification should be ONE signal; ID-based KYC (DigiLocker / aggregator) is the canonical source of gender. A DigiLocker integration was prototyped earlier in this codebase and reverted — the path is in git history.

### Setup (one-time, already done in this repo — for re-creation)

1. **Silero VAD assets** (`public/vad/`):
   ```bash
   cp node_modules/@ricky0123/vad-web/dist/silero_vad_legacy.onnx public/vad/
   cp node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx public/vad/
   cp node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js public/vad/
   cp node_modules/onnxruntime-web/dist/*.wasm public/vad/
   ```
2. **CREPE TFJS model** (`public/crepe/`) — fetched verbatim from the official `marl/crepe` GitHub Pages demo:
   ```bash
   curl -o public/crepe/model.json https://marl.github.io/crepe/model/model.json
   for i in {1..13}; do
     curl -o "public/crepe/group${i}-shard1of1" \
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
- `safe_circles` — `member_ids[]` (2–11 members), `meeting_point`, `dest_coords`, `route_summary`, `reachedBy[]` (UIDs of members who have marked themselves reached safely), `status` ∈ `forming|matched|completed`.
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

`src/utils/geohash.js` is a hand-rolled base-32 geohash encoder/decoder. The `ngeohash` npm package is also a dependency — check which one a given file uses before changing precision constants. Storage precision = 7; matching prefix length = 4; live-location precision = 6. These are tuned together; changing one without the others will break the matching radius or the privacy guarantee.

### Build chunking

`vite.config.js` splits three large vendor chunks: `mediapipe`, `firebase`, `leaflet`. If you add a heavy SDK that should be lazy-loaded, extend `manualChunks` rather than letting it land in the main bundle.

## Conventions worth knowing

- Field names are mixed **snake_case** (Firestore docs: `member_ids`, `origin_geohash`, `circle_id`, `verification_status`) and **camelCase** (JS-only fields: `userId`, `circleType`). Match the surrounding code — don't normalize aggressively.
- Toasts are via `react-hot-toast`; emergency phone numbers are India defaults in `EMERGENCY_CONTACTS` (`utils/constants.js`).
- The README is detailed and mostly accurate, but the matching-filter discrepancy noted above is the kind of drift to watch for. When in doubt, read `src/services/matching.js` — that's what actually runs.
- **Dashboard input panel** (`src/pages/Dashboard.jsx`) follows an Ola/Uber pattern: focusing source or destination toggles `activeField`, which swaps the bottom map for an in-place suggestion panel ("Use Current Location" → reverse-geocode, recent picks from `localStorage`, live Nominatim search). When extending the form, render any new affordances inside the panel rather than as inline dropdowns under the inputs.
- **Dashboard GPS marker** uses `<CircleMarker>` (pixel-radius dot) plus a soft `<Circle>` ring sized by `position.coords.accuracy` (clamped 30m–50km) — NOT the default `<Marker>`, because Leaflet's default marker icon isn't bundled by Vite. The dot is fed by `navigator.geolocation.watchPosition` (cleaned up on unmount). When `accuracy > 1000m` an overlay warns the user that the fix is approximate — desktop browsers fall back to Wi-Fi/IP geolocation which is intrinsically rough; only phones return tight (5–30m) GPS fixes. `CircleMap.jsx` keeps a `L.Icon.Default.mergeOptions` icon-CDN fix for components that need actual `<Marker>` pins.
- **Leaflet CSS** is imported once globally in `src/index.css` (`@import "leaflet/dist/leaflet.css"`). Don't add per-component imports — they used to exist in `CircleMap`/`LiveMap`/`ComfortMap` and were removed as no-op duplicates.
- **Reverse geocoding** is a one-off inline call to `https://nominatim.openstreetmap.org/reverse` in Dashboard. If reverse-geocoding spreads beyond Dashboard, factor it into `src/services/nominatim.js` and add a per-IP rate-limit note.
