# SafeCircles 🛡️

**SafeCircles** is a personal safety and companion-matching platform designed to help users commute securely. By connecting individuals traveling along similar routes at similar times, SafeCircles forms trusted groups (circles) to ensure nobody has to walk alone.

## 🌟 Key Features

### 🤝 Trip Matching & Companionship
- **Smart Matching:** Finds and matches users heading in the same direction based on Geohash locations and departure times.
- **SafeCircles:** Automatically groups matched users into a "Circle" with real-time updates and shared tracking.

### 🛡️ Ironclad Trust & Verification
- **Liveness Verification:** Ensures user authenticity through Face Detection, Head Movement, and Voice Verification using MediaPipe.
- **Reputation System:** Users build trust over time through a community-driven reputation score (0-5 stars) and verified badges.

### 🚨 Emergency & SOS Tools
- **Emergency Dashboard:** Immediate access to critical safety features.
- **Fake Call:** Simulates an incoming phone call to help users exit uncomfortable situations.
- **One-Tap SOS:** Instantly alerts your trusted emergency contacts and your current "Circle" members.
- **Live Location Sharing:** Share your real-time path with friends, family, or your matched companions.

## 🛠️ Technology Stack

- **Frontend:** React + Vite, Tailwind CSS
- **Backend/Database:** Firebase (Authentication, Firestore, Cloud Functions, Storage)
- **Maps & Routing:** Leaflet (`react-leaflet`), Geohashing (`ngeohash`)
- **AI/ML Verification:** MediaPipe (`@mediapipe/face_mesh`, drawing utils)
- **Audio/Voice:** Tone.js
- **State Management:** Zustand

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- A Firebase project with Firestore, Authentication, and Cloud Functions enabled.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/SafeCircles.git
   cd SafeCircles
   ```

2. **Install dependencies:**
   The project has multiple environments. Install dependencies for all of them:
   ```bash
   # Main frontend
   npm install

   # Backend services
   cd backend && npm install
   cd ..

   # Cloud Functions
   cd functions && npm install
   cd ..
   ```

3. **Environment Setup:**
   Create a `.env.local` file in the root directory based on `.env.example`:

   ```env
   # Firebase Configuration
   VITE_FIREBASE_API_KEY=your_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id

   # App Configuration
   VITE_APP_URL=http://localhost:3000
   VITE_MAPS_API_KEY=your_maps_key_here

   # Feature Flags
   VITE_ENABLE_VERIFICATION=true
   VITE_ENABLE_MATCHING=true
   VITE_ENABLE_NOTIFICATIONS=true
   VITE_ENABLE_LOCATION_TRACKING=true
   ```

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```

## 📚 API & Core Services
For detailed information regarding backend matching logic, trip creation, and listener integrations, please see our [API Reference](API_REFERENCE.md).
