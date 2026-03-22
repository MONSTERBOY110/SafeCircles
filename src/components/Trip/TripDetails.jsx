import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Link } from 'react-router-dom';
import { formatTime } from '../../utils/timeUtils';

export default function TripDetails({ tripId }) {
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) return;
    const unsub = onSnapshot(doc(db, 'trips', tripId), (snap) => {
      if (snap.exists()) setTrip({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
    return unsub;
  }, [tripId]);

  if (loading) return <p className="text-gray-500 animate-pulse">Loading trip details...</p>;
  if (!trip) return <p className="text-red-500">Trip not found.</p>;

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-4">
      <h3 className="text-xl font-bold text-gray-800">Trip Details</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500 font-semibold">From</span>
          <p className="font-bold">{trip.origin_landmark}</p>
        </div>
        <div>
          <span className="text-gray-500 font-semibold">To</span>
          <p className="font-bold">{trip.destination_landmark}</p>
        </div>
        <div>
          <span className="text-gray-500 font-semibold">Status</span>
          <p className={`font-bold ${trip.status === 'active' ? 'text-green-600' : trip.status === 'pending' ? 'text-yellow-600' : 'text-gray-500'}`}>
            {trip.status === 'pending' ? '⏳ Finding circle...' : trip.status === 'active' ? '✅ Circle found!' : trip.status}
          </p>
        </div>
        <div>
          <span className="text-gray-500 font-semibold">Type</span>
          <p className="font-bold capitalize">{trip.circle_type?.replace('_', ' ')}</p>
        </div>
      </div>

      {trip.status === 'active' && trip.circle_id && (
        <Link to={`/circle/${trip.circle_id}`} className="btn-primary block text-center">
          🛡️ Open My Circle →
        </Link>
      )}
      {trip.status === 'pending' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-yellow-700 font-semibold animate-pulse">Searching for your circle...</p>
          <p className="text-yellow-600 text-xs mt-1">This usually takes under 30 seconds</p>
        </div>
      )}
    </div>
  );
}
