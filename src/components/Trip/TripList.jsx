import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { Link } from 'react-router-dom';
import { formatTime } from '../../utils/timeUtils';

export default function TripList() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'trips'),
      where('user_id', '==', user.uid),
      where('status', 'in', ['pending', 'active'])
    );

    const unsub = onSnapshot(q, (snap) => {
      setTrips(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return unsub;
  }, []);

  if (loading) return <p className="text-gray-500">Loading trips...</p>;
  if (trips.length === 0) return (
    <div className="text-center py-8">
      <p className="text-gray-500">No active trips. Create one to get started!</p>
      <Link to="/create-trip" className="btn-primary inline-block mt-4">Create Trip</Link>
    </div>
  );

  return (
    <div className="space-y-4">
      {trips.map(trip => (
        <div key={trip.id} className="border border-gray-200 rounded-xl p-5 flex justify-between items-center bg-white hover:shadow-md transition">
          <div>
            <p className="font-bold text-gray-800">
              {trip.origin_landmark} → {trip.destination_landmark}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              Status: <span className={`font-semibold ${trip.status === 'active' ? 'text-green-600' : 'text-yellow-600'}`}>
                {trip.status === 'pending' ? '⏳ Finding circle...' : '✅ Circle found!'}
              </span>
            </p>
          </div>
          {trip.circle_id && (
            <Link to={`/circle/${trip.circle_id}`} className="btn-primary text-sm px-4 py-2">
              View Circle →
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
