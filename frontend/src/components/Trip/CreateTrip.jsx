import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';

export default function CreateTrip() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'trips'),
      where('user_id', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const fetchedTrips = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      fetchedTrips.sort((a, b) => {
        const timeA = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
        const timeB = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
        return timeB - timeA;
      });
      setTrips(fetchedTrips);
      setLoading(false);
    });

    return unsub;
  }, []);

  const activeTrips = trips.filter((t) => t.status === 'pending' || t.status === 'active');
  const pastTrips = trips.filter((t) => t.status === 'completed' || t.status === 'cancelled');
  const displayedTrips = activeTab === 'active' ? activeTrips : pastTrips;

  return (
    <div>
      <div className="mb-6 flex rounded-2xl border border-[var(--border-light)] bg-white p-1 shadow-sm">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${activeTab === 'active' ? 'bg-[var(--color-700)] text-white shadow-md' : 'text-[var(--text-caption)] hover:text-[var(--color-700)]'}`}
        >
          Active Trips
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${activeTab === 'past' ? 'bg-[var(--color-700)] text-white shadow-md' : 'text-[var(--text-caption)] hover:text-[var(--color-700)]'}`}
        >
          Past Trips
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="py-10 text-center opacity-50">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-700)] border-t-transparent"></div>
            <p className="font-medium tracking-wide text-[var(--text-caption)]">Loading trips...</p>
          </div>
        ) : displayedTrips.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">Trips</div>
            <p className="empty-state-desc">No {activeTab} trips yet.</p>
          </div>
        ) : (
          displayedTrips.map((trip) => (
            <div key={trip.id} className={`trip-card ${trip.status === 'completed' ? 'completed' : trip.status === 'pending' ? 'pending' : 'matched'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-3">
                    <span className="route-dot origin"></span>
                    <h3 className="truncate text-base font-bold leading-tight text-[var(--color-900)]">{trip.origin_landmark || 'Unknown Origin'}</h3>
                  </div>
                  <div className="route-line my-1"></div>
                  <div className="flex items-center gap-3">
                    <span className="route-dot destination"></span>
                    <h3 className="truncate text-base font-bold leading-tight text-[var(--color-900)]">{trip.destination_landmark || 'Unknown Destination'}</h3>
                  </div>
                </div>
                <span className={`chip ${trip.status === 'completed' ? 'chip-completed' : trip.status === 'pending' ? 'chip-pending' : 'chip-matched'}`}>
                  {trip.status}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-[var(--border-light)] pt-3 text-sm">
                <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-caption)]">
                  <span>Time</span>
                  {trip.created_at?.toDate ? trip.created_at.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                </span>
                {trip.circle_type && (
                  <span className="chip chip-matched">
                    {trip.circle_type.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
