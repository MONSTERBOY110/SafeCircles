# Trip Management - API Quick Reference

## Functions

### `createTrip(tripData)`
Creates a pending trip in Firestore.

```javascript
import { createTrip } from '../services/matching';

const tripId = await createTrip({
  origin: "Central Station",
  destination: "Airport",
  departureTime: "14:30", // HH:MM format
  circlePreference: "Mixed",
  originCoords: { lat: 40.7580, lng: -73.9855 },
  destCoords: { lat: 40.7780, lng: -73.8740 }
});
// Returns: "trip_abc123"
```

---

### `findAndMatchTrips(newTripData, newTripId)`
Automatically finds matching trips and creates SafeCircle.

```javascript
import { findAndMatchTrips } from '../services/matching';

const result = await findAndMatchTrips(tripData, tripId);

if (result?.success) {
  console.log(`Found ${result.memberCount} member circle`);
  // result = {
  //   success: true,
  //   circleId: "circle_xyz789",
  //   memberCount: 3,
  //   matchedTrips: 2
  // }
} else {
  console.log('No matches found yet');
}
```

---

### `listenToUserTrips(userId, callback)`
Real-time listener for user's trips.

```javascript
import { listenToUserTrips } from '../services/matching';

const unsubscribe = listenToUserTrips(currentUser.uid, (trips) => {
  console.log('Trips updated:', trips);
  
  // trips = [
  //   {
  //     id: "trip1",
  //     origin_landmark: "Central Station",
  //     status: "pending",
  //     circle_id: null
  //   },
  //   {
  //     id: "trip2",
  //     origin_landmark: "Downtown",
  //     status: "matched",
  //     circle_id: "circle789"
  //   }
  // ]
});

// Cleanup:
return () => unsubscribe();
```

---

### `deleteTrip(tripId)`
Deletes a pending trip (only `status === 'pending'`).

```javascript
import { deleteTrip } from '../services/matching';

try {
  await deleteTrip('trip_abc123');
  console.log('Trip deleted');
} catch (error) {
  console.error(error.message); // "Can only delete trips with pending status"
}
```

---

### `getCircleMembers(circleId)`
Fetches all members in a SafeCircle with details.

```javascript
import { getCircleMembers } from '../services/matching';

const members = await getCircleMembers('circle_xyz789');

// Returns:
// [
//   {
//     uid: "user456",
//     name: "John Doe",
//     reputation: 4.5,
//     verified: true
//   },
//   {
//     uid: "user789",
//     name: "Jane Smith",
//     reputation: 4.8,
//     verified: true
//   }
// ]
```

---

### `getTripWithMembers(tripId)`
Fetches a trip with all associated member details.

```javascript
import { getTripWithMembers } from '../services/matching';

const tripWithMembers = await getTripWithMembers('trip_abc123');

// Returns:
// {
//   id: "trip_abc123",
//   origin_landmark: "Central Station",
//   destination_landmark: "Airport",
//   status: "matched",
//   circle_id: "circle_xyz789",
//   members: [
//     { uid: "user1", name: "John", reputation: 4.5, verified: true },
//     { uid: "user2", name: "Jane", reputation: 4.8, verified: true }
//   ]
// }
```

---

## Components

### `<TripList />`
Displays list of user trips with delete option.

```javascript
import TripList from '../components/Trip/TripList';

export default function MyTripsView() {
  return (
    <div>
      <h1>My Trips</h1>
      <TripList />
    </div>
  );
}
```

**Features:**
- Real-time trip updates
- Delete button for pending trips
- Member display for matched trips
- Status badges (Searching, Circle Ready, Active)
- Link to full circle view

---

### `<TripsPage />`
Full page view of all trips organized by status.

**Route:** `/trips`

```javascript
// In App.jsx
<Route path="/trips" element={<ProtectedRoute><TripsPage /></ProtectedRoute>} />
```

**Features:**
- Sections: "Finding Companions" + "Your SafeCircles"
- Full member cards with details
- Delete buttons for pending trips
- Time/date formatting
- View full circle links

---

## Constants & Types

### Trip Status Values
```javascript
// Valid statuses:
"pending"  // Waiting for matches
"matched"  // SafeCircle formed
"active"   // Trip in progress
"completed" // Finished
```

### Geohash Precision
```javascript
// Storage precision: 7 characters
const stored = geohashEncode(lat, lng, 7);
// Result: "dr5regx" (~150m accuracy)

// Matching precision: 4 characters
const matchKey = stored.substring(0, 4);
// Result: "dr5r" (~5km radius)
```

### Member Status
```javascript
{
  uid: string,        // Firestore user ID
  name: string,       // Display name
  reputation: number, // 0-5 score (e.g., 4.5)
  verified: boolean   // Verified status
}
```

---

## Usage Examples

### Example 1: Create Trip & Auto-Match
```javascript
import { createTrip, findAndMatchTrips } from '../services/matching';
import toast from 'react-hot-toast';

async function handleCreateTrip(formData) {
  try {
    // 1. Create trip
    const tripId = await createTrip(formData);
    
    // 2. Find matches
    const matches = await findAndMatchTrips(formData, tripId);
    
    // 3. Show result
    if (matches?.success) {
      toast.success(`SafeCircle formed! ${matches.memberCount} members`);
    } else {
      toast.success('Searching for companions...');
    }
  } catch (error) {
    toast.error('Failed to create trip');
  }
}
```

---

### Example 2: List Trips with Real-Time Updates
```javascript
import { useEffect, useState } from 'react';
import { listenToUserTrips } from '../services/matching';
import { useAuth } from '../context/AuthContext';

export default function MyTrips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToUserTrips(user.uid, (updatedTrips) => {
      setTrips(updatedTrips);
    });

    return unsubscribe;
  }, [user]);

  return (
    <div>
      {trips.map(trip => (
        <div key={trip.id}>
          <p>{trip.origin_landmark} → {trip.destination_landmark}</p>
          <p>Status: {trip.status}</p>
        </div>
      ))}
    </div>
  );
}
```

---

### Example 3: Delete Trip with Confirmation
```javascript
import { deleteTrip } from '../services/matching';
import toast from 'react-hot-toast';

async function handleDeleteTrip(tripId) {
  if (!confirm('Delete this trip?')) return;

  try {
    await deleteTrip(tripId);
    toast.success('Trip deleted');
  } catch (error) {
    toast.error(error.message);
  }
}
```

---

### Example 4: Display Circle Members
```javascript
import { useEffect, useState } from 'react';
import { getCircleMembers } from '../services/matching';

export default function CircleMembers({ circleId }) {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    getCircleMembers(circleId).then(setMembers);
  }, [circleId]);

  return (
    <div>
      {members.map(member => (
        <div key={member.uid}>
          <p>{member.name}</p>
          {member.verified && <span>✓ Verified</span>}
          <p>⭐ {member.reputation}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## Error Handling

### Safe Trip Deletion
```javascript
try {
  await deleteTrip(tripId);
} catch (error) {
  if (error.message.includes('pending')) {
    toast.error('Can only delete pending trips');
  } else {
    toast.error('Failed to delete trip');
  }
}
```

### Safe Member Fetching
```javascript
try {
  const members = await getCircleMembers(circleId);
  if (!members || members.length === 0) {
    setEmptyState(true);
  }
} catch (error) {
  console.error('Failed to load members:', error);
  setMembers([]);
}
```

### Safe Listener Cleanup
```javascript
useEffect(() => {
  const unsubscribe = listenToUserTrips(userId, (trips) => {
    // Update UI
  });

  // Cleanup MUST happen
  return () => {
    if (unsubscribe) unsubscribe();
  };
}, [userId]);
```

---

## Firestore Field Mapping

| JavaScript | Firestore | Type | Example |
|-----------|-----------|------|---------|
| `trip.user_id` | `user_id` | string | `"user456"` |
| `trip.origin_landmark` | `origin_landmark` | string | `"Central Station"` |
| `trip.origin_geohash` | `origin_geohash` | string | `"dr5regx"` |
| `trip.circle_id` | `circle_id` | string | `"circle789"` |
| `trip.status` | `status` | string | `"matched"` |
| `circle.member_ids` | `member_ids` | array | `["uid1", "uid2"]` |
| `user.verification_status` | `verification_status` | string | `"VERIFIED"` |
| `user.reputation_score` | `reputation_score` | number | `4.5` |

---

## Navigation

### Link to Trips Page
```javascript
import { Link } from 'react-router-dom';

<Link to="/trips">View All Trips</Link>
```

### Link to Create Trip
```javascript
<Link to="/create-trip">Create New Trip</Link>
```

### Link to Circle
```javascript
<Link to={`/circle/${circleId}`}>View Circle</Link>
```

---

## Debugging Helpers

### Log Trip Status
```javascript
trips.forEach(trip => {
  console.log(`${trip.origin_landmark}: ${trip.status}`);
  if (trip.circle_id) {
    console.log(`  Circle: ${trip.circle_id}`);
  }
});
```

### Check Geohash Match
```javascript
const trip1Prefix = trip1.origin_geohash.substring(0, 4);
const trip2Prefix = trip2.origin_geohash.substring(0, 4);
console.log(
  `Match: ${trip1Prefix === trip2Prefix}`,
  `("${trip1Prefix}" vs "${trip2Prefix}")`
);
```

### Monitor Real-Time Listener
```javascript
const unsub = listenToUserTrips(userId, (trips) => {
  console.log(`[${new Date().toLocaleTimeString()}] Trips updated:`, trips.length);
});
```

---

## Type Safety (TypeScript)

```typescript
interface Trip {
  id: string;
  user_id: string;
  origin_landmark: string;
  destination_landmark: string;
  status: 'pending' | 'matched' | 'active' | 'completed';
  circle_id: string | null;
  origin_geohash: string;
  dest_geohash: string;
  created_at: Date;
  expires_at: Date;
}

interface Member {
  uid: string;
  name: string;
  reputation: number;
  verified: boolean;
}

interface MatchResult {
  success: boolean;
  circleId: string;
  memberCount: number;
  matchedTrips: number;
}
```

---

## Performance Tips

### Optimize Listener Count
```javascript
// ❌ DON'T: Create listener in every component
export function Component() {
  useEffect(() => {
    listenToUserTrips(user.uid, ...); // Created every render!
  }, []); // Missing dependency!
}

// ✅ DO: Create listener once with proper cleanup
export function Component() {
  useEffect(() => {
    if (!user) return;
    const unsub = listenToUserTrips(user.uid, ...);
    return () => unsub(); // Cleanup!
  }, [user.uid]); // Proper dependencies
}
```

### Batch Operations
```javascript
// ❌ DON'T: Multiple updates
await updateDoc(doc(db, 'trips', id1), data);
await updateDoc(doc(db, 'trips', id2), data);

// ✅ DO: Batch write
const batch = writeBatch(db);
batch.update(doc(db, 'trips', id1), data);
batch.update(doc(db, 'trips', id2), data);
await batch.commit();
```

---

Ready to integrate trip management into your app? Start with `createTrip()` → `findAndMatchTrips()` → display with `<TripList />` or `<TripsPage />`! 🚀
