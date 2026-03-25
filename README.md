# SafeCircles 🛡️

A **real-time safety companion app** for women to form verified walking circles and travel safely together.

## Features

- 🔐 **3-Step Video Verification** — Face detection, head movement liveness check, and voice pitch analysis to verify real human users
- 👥 **Smart Circle Matching** — Automatically groups verified users traveling the same route at the same time
- 🗺️ **Live Route Maps** — Leaflet.js maps showing meeting points, CCTV coverage, and police booths
- 🚨 **Emergency Tools** — Alert circle, fake call, one-tap location share, and direct emergency contacts
- 💬 **Circle Chat** — Real-time group messaging for coordinating with your circle
- 📍 **Comfort Map** — Crowd-sourced safety ratings for streets and areas
- ⭐ **Reputation System** — Trust score built through completed safe trips

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Routing | React Router v6 |
| Backend | Firebase (Auth, Firestore, Storage, Functions) |
| Maps | Leaflet.js + OpenStreetMap (free) |
| Verification | MediaPipe Face Mesh, Web Audio API |
| Real-time | Firestore WebSocket listeners |

## Quick Start

### Prerequisites
- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project with Auth, Firestore, Storage, and Functions enabled

### Installation

```bash
git clone <your-repo>
cd safecircles
npm install
```

### Environment Setup

```bash
cp .env.example .env.local
# Edit .env.local with your Firebase credentials
```

### Development

```bash
npm run dev

```

## Project Structure

```
src/
├── components/     # Reusable UI components (Auth, Verification, Trip, Circle, Emergency...)
├── pages/          # Route-level page components
├── services/       # Firebase service wrappers
├── hooks/          # Custom React hooks
├── context/        # React context providers
├── utils/          # Pure utility functions (geohash, haversine, pitch detection...)
└── styles/         # Global CSS and animations

functions/          # Firebase Cloud Functions (matching, trip completion, incidents)
```

## Key Algorithms

- **Pitch Detection** — Yin autocorrelation algorithm, female voice: 165–255 Hz
- **Lip-Sync Detection** — Pearson correlation between mouth movement and audio energy
- **Geohashing** — Precision 7 (~1.2 km) for privacy-preserving location clustering
- **Haversine Formula** — Great-circle distance for ETA calculation at 5 km/h walking speed
- **Matching Algorithm** — Overlapping time window + same geohash + reputation sorting

## Security & Privacy

- Exact GPS coordinates are never stored — only geohash-rounded positions
- Video never stored; verification badge is permanent after passing
- Firestore rules restrict data access per-user and per-circle
- Circle data auto-deletes after 90 minutes (TTL)
