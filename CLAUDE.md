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

## Architecture

SafeCircles is a React 18 + Vite SPA backed by Firebase (Auth + Firestore + Storage + Hosting + Functions). It forms ad-hoc "safe circles" of nearby travelers in real time.

### Frontend-driven matching (the load-bearing design choice)

The matching engine that pairs travelers into circles runs **client-side**, not in Cloud Functions. The canonical implementation is `findAndMatchTrips()` in `src/services/matching.js`. When a user creates a trip, the dashboard calls this function, which:

1. Reads all `trips` with `status == 'pending'` from Firestore.
2. Filters to trips whose **origin geohash prefix (first 4 chars)** matches the new trip's. Storage precision is 7 chars (~150m), but matching widens to a 4-char prefix (~5km cluster). The full 7-char hash is *not* used as the join key.
3. For each candidate, fetches the user doc and keeps only verified users (`isVerified === true` OR `verification_status === 'VERIFIED'` — both shapes exist in the wild).
4. Deduplicates by `userId`, sorts by reputation, takes top 4, creates a `safe_circles` doc, and batches the trip docs to `status: 'matched'` with the new `circle_id`.

Things to know when touching this path:
- **The README overstates the filter set.** The current code does *not* filter by `dest_geohash` or by `departure_window` overlap — only origin-prefix + verification. If you add those filters, update the README too.
- The frontend creates a `safe_circles` document with `status: 'forming'`, but `trips` are flipped to `status: 'matched'`. UIs/listeners check both — don't change one without the other.
- Cloud Functions in `backend/matchUsers.js` exist but are **not the source of truth**; the frontend path is what runs in production. Treat the function as a fallback / future server-side path, not a mirror.
- `listenToTrip` in `matching.js` uses CommonJS `require('firebase/firestore')` inside an ESM module — it will throw if called. Prefer building listeners with the already-imported `onSnapshot`/`doc` rather than reusing this helper.

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
1. `FaceDetection.jsx` — MediaPipe Face Mesh loaded via CDN; thresholds in `utils/faceValidation.js` and `utils/constants.js` (`VERIFICATION.FACE_CENTER_MIN/MAX`).
2. `HeadMovement.jsx` — liveness via head rotations.
3. `VoiceVerification.jsx` — Web Audio API + autocorrelation pitch detection (`utils/pitchDetection.js`), with optional lip-sync check (`utils/lipSyncDetection.js`). Sentences come from `VOICE_PROMPTS` in `utils/constants.js`.

Verification writes set `verification_status: 'VERIFIED'` (and/or `isVerified: true`) on the `users` doc — the matching code accepts either field. If you change the schema here, change the OR-check in `findAndMatchTrips`.

### Firestore data model

Collections used by the app (see README "Firestore Collections" for full shapes):
- `users` — profile + verification + reputation (`reputation_score` *and* `reputation` are both read by matching code; prefer `reputation_score`).
- `trips` — origin/dest landmarks, `origin_coords`/`dest_coords`, `origin_geohash`/`dest_geohash` (precision 7), `departure_window`, `status` ∈ `pending|matched|active|completed`, `circle_id`, `expires_at` (90 min TTL — see `MATCHING.TRIP_TTL_MINUTES`).
- `safe_circles` — `member_ids[]`, `meeting_point`, `dest_coords`, `route_summary`, `status` ∈ `forming|matched|completed`.
- `live_locations` — geohash precision 6 (~600m) for privacy. Updated every ~10s by `services/locationTracking.js`.
- `alerts`, `safety_pings`, `trip_logs` — emergency events, status pings, completed-trip history.

`firestore.rules` currently allows all reads/writes — this is **dev-only** and must be tightened before production. Don't assume the rules enforce anything when reasoning about security.

### Geohashing

`src/utils/geohash.js` is a hand-rolled base-32 geohash encoder/decoder. The `ngeohash` npm package is also a dependency — check which one a given file uses before changing precision constants. Storage precision = 7; matching prefix length = 4; live-location precision = 6. These are tuned together; changing one without the others will break the matching radius or the privacy guarantee.

### Build chunking

`vite.config.js` splits three large vendor chunks: `mediapipe`, `firebase`, `leaflet`. If you add a heavy SDK that should be lazy-loaded, extend `manualChunks` rather than letting it land in the main bundle.

## Conventions worth knowing

- Field names are mixed **snake_case** (Firestore docs: `member_ids`, `origin_geohash`, `circle_id`, `verification_status`) and **camelCase** (JS-only fields: `userId`, `circleType`). Match the surrounding code — don't normalize aggressively.
- Toasts are via `react-hot-toast`; emergency phone numbers are India defaults in `EMERGENCY_CONTACTS` (`utils/constants.js`).
- The README is detailed and mostly accurate, but the matching-filter discrepancy noted above is the kind of drift to watch for. When in doubt, read `src/services/matching.js` — that's what actually runs.
