import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Link } from 'react-router-dom';

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

  if (loading) return <p className="animate-pulse text-[#EAE0C8]/50">Loading trip details...</p>;
  if (!trip) return <p className="text-red-400">Trip not found.</p>;

  return (
    <div className="space-y-4 rounded-xl border border-white/5 bg-[#111A3A]/70 p-6 shadow">
      <h3 className="text-xl font-bold text-[#EAE0C8]">Trip Details</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-semibold text-[#EAE0C8]/50">From</span>
          <p className="font-bold text-[#EAE0C8]">{trip.origin_landmark}</p>
        </div>
        <div>
          <span className="font-semibold text-[#EAE0C8]/50">To</span>
          <p className="font-bold text-[#EAE0C8]">{trip.destination_landmark}</p>
        </div>
        <div>
          <span className="font-semibold text-[#EAE0C8]/50">Status</span>
          <p className={`font-bold ${trip.status === 'active' ? 'text-green-400' : trip.status === 'pending' ? 'text-blue-300' : 'text-[#EAE0C8]/60'}`}>
            {trip.status === 'pending' ? 'Finding circle...' : trip.status === 'active' ? 'Circle found!' : trip.status}
          </p>
        </div>
        <div>
          <span className="font-semibold text-[#EAE0C8]/50">Type</span>
          <p className="font-bold capitalize text-[#EAE0C8]">{trip.circle_type?.replace('_', ' ')}</p>
        </div>
      </div>

      {trip.status === 'active' && trip.circle_id && (
        <Link to={`/circle/${trip.circle_id}`} className="btn-primary block text-center">
          Open My Circle
        </Link>
      )}
      {trip.status === 'pending' && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4 text-center">
          <p className="animate-pulse font-semibold text-blue-300">Searching for your circle...</p>
          <p className="mt-1 text-xs text-[#EAE0C8]/50">This usually takes under 30 seconds</p>
        </div>
      )}
    </div>
  );
}
