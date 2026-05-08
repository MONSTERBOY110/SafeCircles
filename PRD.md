# SafeCircles – Product Requirements Document

## 1. Product Overview

SafeCircles is a women-focused safety web application that helps verified users travel together by forming real-time temporary safety groups called **SafeCircles**.

The platform allows users to sign up, complete identity verification, create trips with source and destination, get matched with nearby verified users travelling on similar routes, view matched circle members, communicate through in-app chat, and use emergency/safety tools during the journey.

The core idea is simple:

> Instead of letting women travel alone, SafeCircles connects them with nearby verified users so they can move together safely.

---

## 2. Problem Statement

Women often face safety concerns while travelling alone, especially during evenings or late hours. In many cases, they are forced to choose between:

- Walking alone and feeling unsafe
- Paying extra for cabs or private transport
- Avoiding opportunities altogether

Most existing safety apps are reactive. They provide SOS buttons or emergency alerts after something has already gone wrong. They do not actively prevent risky solo travel.

Social tools like WhatsApp groups also fail because they depend on existing contacts. There is no guarantee that someone from a user’s known circle will be nearby at the same time and location.

SafeCircles solves this gap by creating real-time, verified, location-based travel groups.

---

## 3. Target Users

### Primary Users

- Women aged 18–35
- College students
- Working professionals
- Interns
- Daily commuters
- Women living away from home in urban or semi-urban areas

### Initial Target Geography

- Kolkata
- Jadavpur University surrounding areas
- Salt Lake / Kestopur / Baguiati / Karunamoyee areas
- Other metro and semi-urban Indian cities in future

### User Behaviour

Target users often:

- Travel alone
- Use public transport or walk short distances
- Share live location with friends/family
- Avoid evening travel due to fear
- Need low-cost safety support

---

## 4. Product Goals

### Primary Goals

1. Enable verified users to create trips.
2. Match users travelling on similar routes and time windows.
3. Form temporary SafeCircles for group travel.
4. Provide circle-level communication through chat.
5. Improve confidence and safety during travel.

### Secondary Goals

1. Provide emergency tools inside the circle page.
2. Show route and map-based trip information.
3. Support offline/low-network fallback.
4. Build reputation and trust over time.
5. Scale toward college, community, and workplace deployments.

---

## 5. Core Features

## 5.1 User Authentication

### Description

Users can create accounts and log in using Firebase Authentication.

### Requirements

- Signup with name, email, and password
- Login with email and password
- Store user details in Firestore
- Profile page should show user details
- Firestore user document should include verification and reputation data

### Firestore User Structure

```js
users/{uid} = {
  uid: string,
  name: string,
  email: string,
  gender: "female",
  isVerified: boolean,
  reputation: number,
  createdAt: timestamp
}
````

### Acceptance Criteria

* New users appear in Firebase Authentication.
* Corresponding user documents are created in Firestore.
* Login works with Firebase Authentication credentials.
* Profile page fetches latest Firestore user data.

---

## 5.2 Verification Flow

### Description

Before using safety and matching features, users should complete identity verification.

### Verification Steps

1. Face Detection
2. Head Movement Challenge
3. Voice Verification

### Step 1: Face Detection

Technology:

* MediaPipe Face Mesh

Purpose:

* Detect live face
* Check face presence
* Ensure user is in frame

### Step 2: Head Movement Challenge

Challenge actions:

* Look left
* Look right
* Smile

Purpose:

* Prevent static image usage
* Add liveness check

### Step 3: Voice Verification

Technology:

* Web Audio API
* Speech / pitch analysis
* Random prompt reading

Checks:

* Speech detection
* Voice energy
* Pitch range
* Random text matching
* Duration check

### Current Demo Behaviour

For demo purposes, verified accounts can be manually marked as:

```js
isVerified: true
```

in Firestore.

### Acceptance Criteria

* Unverified users are prompted to verify.
* Verified users are allowed to create trips.
* Firestore updates `isVerified: true` after successful verification.
* Profile page displays verified status correctly.

---

## 5.3 Dashboard Trip Creation

### Description

Verified users can create a trip from the Dashboard by entering source and destination.

### Current Required Fields

* Origin
* Destination
* Origin coordinates
* Destination coordinates
* Origin geohash
* Destination geohash
* Time window
* Status
* User ID

### Trip Creation Behaviour

* Dashboard always shows the trip creation form.
* Dashboard should not display “Finding SafeCircle” UI.
* After trip creation, trip data is stored in Firestore.
* Matching logic runs after trip creation.

### Firestore Trip Structure

```js
trips/{tripId} = {
  userId: string,
  origin: string,
  destination: string,
  origin_coords: {
    lat: number,
    lng: number
  },
  destination_coords: {
    lat: number,
    lng: number
  },
  origin_geohash: string,
  dest_geohash: string,
  timeWindowStart: number,
  timeWindowEnd: number,
  circleType: "Women Only",
  isVerified: true,
  status: "pending" | "matched" | "completed" | "cancelled",
  circle_id: string | null,
  createdAt: timestamp,
  completedAt: timestamp | null
}
```

### Acceptance Criteria

* Only verified users can create trips.
* New trip appears in Firestore.
* Trip uses `userId`, not `user_id`.
* Dashboard remains clean and always allows new trip creation unless an active trip exists.

---

## 5.4 Location Suggestions

### Description

Dashboard source and destination inputs should provide location suggestions similar to Google Maps.

### Technology

* OpenStreetMap Nominatim API
* Leaflet
* Geohash

### Behaviour

* User types at least 3 characters.
* Suggestions appear below input.
* User selects a suggestion.
* Selected suggestion stores label, latitude, and longitude.
* Trip creation uses selected coordinates.

### Suggested API

```txt
https://nominatim.openstreetmap.org/search?format=json&q=<query>&limit=5
```

### Acceptance Criteria

* Source suggestions appear while typing.
* Destination suggestions appear while typing.
* User must select valid suggestions before creating trip.
* Coordinates are saved with trip document.

---

## 5.5 Real-Time Matching

### Description

When a user creates a trip, SafeCircles attempts to match them with another verified user travelling from a nearby origin.

### Matching Strategy

Current implementation uses frontend-based matching due to Firebase Cloud Functions requiring Blaze plan.

### Matching Conditions

* Other trip must be pending.
* Other trip must belong to a different user.
* Other user must be verified.
* Origin geohash prefix should match.
* Duplicate users should be removed.
* Matching should create a SafeCircle.

### Matching Logic

1. User creates trip.
2. Fetch pending trips.
3. Filter invalid trips.
4. Exclude own trip.
5. Match nearby origin geohash.
6. Fetch matched users from Firestore.
7. Keep only verified users.
8. Remove duplicate users.
9. Create `safe_circles` document.
10. Update current and matched trips to `matched`.

### SafeCircle Firestore Structure

```js
safe_circles/{circleId} = {
  member_ids: [uid1, uid2],
  members: [
    {
      userId: string,
      name: string,
      reputation: number
    }
  ],
  meeting_point: string,
  source: string,
  destination: string,
  status: "forming" | "active" | "completed",
  created_at: timestamp,
  reachedBy: []
}
```

### Acceptance Criteria

* Two verified users creating similar trips get matched.
* SafeCircle document is created.
* Both trips update to `matched`.
* Duplicate members are not shown.
* Trips page updates in real time.

---

## 5.6 Trips Page

### Description

The Trips page displays the current user’s trips based on status.

### States

1. No Trips
2. Pending Trips
3. Matched Trips
4. Completed Trips

### Behaviour

#### No Trips

Show:

```txt
No trips yet. Create one from dashboard.
```

#### Pending Trip

Show:

```txt
Finding your SafeCircle...
```

After 10 seconds:

```txt
No nearby users found yet. Still searching...
```

Also show a “Try Again” option to delete current pending trip.

#### Matched Trip

Show:

* Origin
* Destination
* Member names
* Meeting point
* View Circle button

#### Completed Trip

Should not appear as active. It can appear in Past Trips or be hidden depending on UI choice.

### Delete Trip

Users can delete pending trips if created by mistake.

Rules:

* Only delete if `status === "pending"`.
* Only owner can delete.
* Firestore trip document is removed.

### Acceptance Criteria

* Trips page uses `userId`.
* Pending, matched, completed trips are displayed separately.
* Delete button works only for pending trips.
* Matched trips have View Circle button.

---

## 5.7 Circle Page

### Description

Circle Page is the live journey page for a matched SafeCircle.

### Current Features

* Shows circle members
* Shows meeting point
* Shows map
* Shows source and destination pins
* Shows chat section
* Allows user to mark reached safely

### Page Sections

1. Circle header
2. Member list
3. Meeting point
4. Map
5. Chat
6. Emergency / safety tools
7. Mark as Reached Safely button

---

## 5.8 Circle Chat

### Description

Each SafeCircle has its own persistent real-time chat.

### Firestore Structure

```js
safe_circles/{circleId}/messages/{messageId} = {
  text: string,
  senderId: string,
  senderName: string,
  createdAt: timestamp
}
```

### Behaviour

* User sends message from Circle Page.
* Message is stored in Firestore.
* All members can view messages.
* Messages persist after logout/login.
* Real-time updates happen using Firestore `onSnapshot`.

### Acceptance Criteria

* Puskar2 sends message.
* Puskar3 can see the message.
* Puskar3 replies.
* Puskar2 can see old and new messages.
* Sender names show correctly from Firestore user profile.

---

## 5.9 Reached Safely Flow

### Description

When a user reaches their destination, they can mark themselves as safely reached.

### Behaviour

* Current user’s trip status becomes `completed`.
* User is redirected to Dashboard.
* Trip disappears from active trips.
* Other members can independently mark themselves reached later.
* SafeCircle becomes completed only after all members mark reached.

### Firestore Updates

For current user’s trip:

```js
status: "completed",
completedAt: serverTimestamp()
```

For SafeCircle:

```js
reachedBy: arrayUnion(currentUser.uid)
```

If all members reached:

```js
status: "completed"
```

### Acceptance Criteria

* Mark as Reached Safely redirects user to Dashboard.
* Current user can create a new trip afterward.
* Other users are not forced to complete their trip.
* Trips page no longer shows completed trip as active.

---

## 5.10 Map and Route

### Description

Circle Page map should show source, destination, meeting point, and route.

### Technology

* Leaflet
* OpenStreetMap
* OSRM Routing API

### Route API

```txt
https://router.project-osrm.org/route/v1/foot/{sourceLng},{sourceLat};{destLng},{destLat}?overview=full&geometries=geojson
```

### Requirements

* Show source marker
* Show destination marker
* Show meeting point marker
* Show walking route polyline
* If route fails, still show map markers

### Acceptance Criteria

* Route line appears between source and destination.
* Map does not crash if route API fails.
* Leaflet map renders properly with fixed height.

---

## 5.11 Emergency Features

### Description

Emergency tools are available inside Circle Page.

### Features

1. Alert Circle
2. Fake Call
3. Share Location
4. Emergency Call

### Expected Behaviour

#### Alert Circle

* Sends alert document to Firestore.
* Notifies or visually indicates alert inside circle.

#### Fake Call

* Opens fake incoming call UI.
* Can work offline.
* Does not require backend.

#### Share Location

* Uses navigator.share or WhatsApp link.
* Shares current circle/location information.

#### Emergency Call

* Provides quick call links:

  * Police: 100
  * Women Helpline: 1090

### Acceptance Criteria

* Buttons are visible and usable.
* No broken buttons should remain.
* Offline-safe tools should still work without internet.

---

## 5.12 Offline / Low Network Support

### Problem

Internet may be slow or unstable during travel.

### Proposed Solution

Offline trip creation with deferred sync.

### Behaviour

If internet is unavailable during trip creation:

1. Trip is stored locally using localStorage or IndexedDB.
2. UI shows:

```txt
Trip saved. Will match when internet is available.
```

3. When internet returns, queued trip syncs to Firestore.
4. Matching begins normally.

### Additional Offline Features

* Show last known SafeCircle data
* Keep meeting point accessible
* Fake call works offline
* Emergency phone call links work without internet

### Acceptance Criteria

* App does not crash when offline.
* User receives clear feedback.
* Queued trip syncs later when internet returns.

---

## 6. Non-Functional Requirements

### Performance

* Trip creation should feel instant.
* Matching should complete within a few seconds when compatible users exist.
* Chat messages should appear in real time.
* Map should load without blocking the rest of the page.

### Security

* Firestore rules should restrict unauthorized access.
* Users should only delete their own pending trips.
* Verification data should not expose sensitive media unnecessarily.

### Privacy

* Avoid storing exact location history.
* Prefer geohash-based approximate location.
* Do not store verification video permanently.
* Circle data should be temporary.

### Reliability

* App should handle:

  * no match found
  * slow network
  * route API failure
  * missing user profile
  * duplicate trips

### UI/UX

* Mobile-first
* Dark premium theme
* No emojis
* Consistent colors:

  * Blue
  * `#EAE0C8`
  * limited green/red for success/error
* Bottom navbar:

  * Trips
  * Dashboard
  * Profile

---

## 7. Tech Stack

### Frontend

* React 18
* Vite
* Tailwind CSS
* React Router
* Lucide React
* Leaflet Maps

### Backend / Database

* Firebase Authentication
* Firebase Firestore
* Firebase Storage
* Firebase Cloud Functions planned for future matching automation

### Matching

* Frontend-based Firestore matching for demo
* Geohash clustering
* Firestore real-time queries

### AI / Verification

* MediaPipe Face Mesh
* Web Audio API
* Speech / pitch analysis

### Maps

* Leaflet
* OpenStreetMap
* Nominatim API
* OSRM Routing API

### Deployment

* Vercel for frontend
* Firebase for backend
* Cloudflare CDN planned/optional

---

## 8. Firestore Collections

### users

Stores user profile and verification data.

```js
users/{uid}
```

### trips

Stores trip creation and matching status.

```js
trips/{tripId}
```

### safe_circles

Stores matched circle details.

```js
safe_circles/{circleId}
```

### messages

Subcollection under each SafeCircle.

```js
safe_circles/{circleId}/messages/{messageId}
```

### alerts

Stores emergency alerts.

```js
alerts/{alertId}
```

### safety_pings

Stores comfort map safety pings.

```js
safety_pings/{pingId}
```

### live_locations

Stores temporary geohashed live location.

```js
live_locations/{userId}
```

### trip_logs

Stores completed trip records.

```js
trip_logs/{logId}
```

---

## 9. User Flow

### Full Flow

1. User signs up.
2. User logs in.
3. User completes verification.
4. Verified user creates trip from Dashboard.
5. System searches for nearby compatible pending trips.
6. Matching logic creates SafeCircle.
7. User views matched trip in Trips page.
8. User opens Circle Page.
9. Users coordinate via chat.
10. Users follow map and meeting point.
11. User marks Reached Safely.
12. Trip is completed for that user.

---

## 10. Demo Flow

### Demo Accounts

* User1: unverified account for verification demo
* User2: verified account for trip creation demo
* User3: verified account for matching demo

### Demo Steps

1. Show unverified user verification flow.
2. Login with verified User2.
3. Create trip.
4. Login with verified User3.
5. Create matching trip.
6. Show matched trip in Trips page.
7. Open Circle Page.
8. Show members, map, chat.
9. Send chat messages between users.
10. Mark Reached Safely.

---

## 11. Business Model

SafeCircles follows a freemium platform model.

### Free Features

* Signup
* Verification
* Trip creation
* Matching
* Basic circle chat
* Basic emergency tools

### Premium / Revenue Streams

* Priority matching
* Advanced safety alerts
* Extended route controls
* Institution dashboards
* College / company partnerships
* Community safety subscriptions

### Cost Structure for 1000 Users

* Vercel frontend hosting: `$0/month`
* Firebase Auth + Firestore: `$5–10/month`
* Cloud Functions: `$5/month`
* OpenStreetMap + OSRM: `$0/month`
* Storage: `$2–5/month`

Estimated total:

```txt
$10–20/month
```

---

## 12. Market Analysis

### Beachhead Market

Urban women aged 18–35 who travel alone during evenings.

Initial focus:

* College students
* Working professionals
* Daily commuters

### TAM

Over 3 crore women in India face regular safety challenges during travel.

### Competitive Advantage

* Real-time dynamic matching
* Verified users
* Location-aware grouping
* Chat and circle coordination
* Does not depend on known contacts like WhatsApp
* Proactive prevention instead of reactive SOS-only model

---

## 13. Success Metrics

### Prototype Metrics

* Successful signup/login
* Successful verification state update
* Successful trip creation
* Successful match creation
* Chat messages sent and received
* User can mark reached safely

### Product Metrics

* Number of trips created
* Number of circles formed
* Average match time
* Number of completed trips
* User retention
* Safety reports / incident reduction
* User trust rating

---

## 14. Known Limitations

* Current matching is frontend-based due to Cloud Functions Blaze plan requirement.
* Verification accuracy needs improvement with real female voice/video testing.
* Emergency features are partially implemented.
* Full offline sync is planned but not fully production-ready.
* Route accuracy depends on OpenStreetMap / OSRM availability.
* Demo currently may use controlled test accounts.

---

## 15. Future Scope

### Short Term

* Improve verification accuracy
* Add better route display
* Polish emergency tools
* Add offline queued trip sync
* Improve mobile responsiveness
* Deploy stable web version

### Medium Term

* Move matching engine to Firebase Cloud Functions or server backend
* Add push notifications
* Add moderator dashboard
* Improve reputation scoring
* Add incident reporting workflow
* Add comfort map

### Long Term

* Institution partnerships
* City-wide safety network
* Integration with police / local authorities
* AI-based risk prediction
* Public safety data integration
* Native Android/iOS app

---

## 16. Team

Team Name:

```txt
TeesMaarKhaCoders
```

Project:

```txt
SafeCircles
```

Track:

```txt
Women Safety
```

---

## 17. Development Tools

* Visual Studio Code
* Git and GitHub
* Firebase Console
* Chrome DevTools
* Brave / Chrome browser testing
* Vercel
* Figma / UI references
* Claude Code / Copilot for development assistance

---

## 18. Deployment Plan

### Frontend

Deploy React Vite app on:

* Vercel

### Backend

Use Firebase services:

* Authentication
* Firestore
* Storage
* Future Cloud Functions

### Environment Variables

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_APP_URL=
```

---

## 19. Acceptance Criteria Summary

The product is considered demo-ready if:

* Users can sign up and log in.
* User profile is created in Firestore.
* Verified user can create trip.
* Two users can match into a SafeCircle.
* Trips page shows pending and matched states.
* Circle page shows members and meeting point.
* Chat works persistently between circle members.
* Reached Safely completes user’s trip.
* User can create another trip after completion.
* UI remains stable without console-breaking errors.

---

## 20. Final Product Vision

SafeCircles aims to become a trusted safety layer for urban mobility.

The goal is not only to react to danger but to prevent unsafe solo travel by enabling verified, real-time, community-based movement.

> SafeCircles transforms unsafe solo travel into safe, collaborative group mobility.

```
```
