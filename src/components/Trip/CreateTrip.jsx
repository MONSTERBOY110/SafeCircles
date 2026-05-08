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
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <h2 className="mb-6 text-3xl font-extrabold tracking-tight text-[#EAE0C8]">Your Trips</h2>

      <div className="mb-6 flex rounded-2xl border border-white/5 bg-[#111A3A]/70 p-1 shadow-lg backdrop-blur-md">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${activeTab === 'active' ? 'bg-blue-600/90 text-[#EAE0C8] shadow-md' : 'text-[#EAE0C8]/50 hover:text-[#EAE0C8]'}`}
        >
          Active Trips
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${activeTab === 'past' ? 'bg-blue-600/90 text-[#EAE0C8] shadow-md' : 'text-[#EAE0C8]/50 hover:text-[#EAE0C8]'}`}
        >
          Past Trips
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="py-10 text-center opacity-50">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            <p className="font-medium tracking-wide text-[#EAE0C8]">Loading trips...</p>
          </div>
        ) : displayedTrips.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-[2rem] border border-white/5 bg-[#111A3A]/70 p-10 text-center shadow-xl backdrop-blur-xl">
            <div className="mb-4 text-5xl opacity-50">Trips</div>
            <p className="text-lg font-medium leading-relaxed text-[#EAE0C8]/50">No {activeTab} trips yet.</p>
          </div>
        ) : (
          displayedTrips.map((trip) => (
            <div key={trip.id} className="flex flex-col gap-3 rounded-[1.5rem] border border-white/5 bg-[#111A3A]/70 p-5 shadow-xl backdrop-blur-xl transition-colors hover:bg-[#111A3A]">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]"></span>
                    <h3 className="truncate text-base font-bold leading-tight text-[#EAE0C8]">{trip.origin_landmark || 'Unknown Origin'}</h3>
                  </div>
                  <div className="my-1 ml-[4px] h-3 w-[2px] rounded-full bg-[#EAE0C8]/10"></div>
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rotate-45 bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]"></span>
                    <h3 className="truncate text-base font-bold leading-tight text-[#EAE0C8]">{trip.destination_landmark || 'Unknown Destination'}</h3>
                  </div>
                </div>
                <span className={`shrink-0 rounded-xl px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest ${trip.status === 'pending' ? 'border border-blue-500/30 bg-blue-500/20 text-blue-300' :
                  trip.status === 'active' ? 'border border-blue-500/30 bg-blue-500/20 text-blue-300' :
                    trip.status === 'completed' ? 'border border-green-500/30 bg-green-500/20 text-green-300' :
                      'border border-white/5 bg-[#EAE0C8]/10 text-[#EAE0C8]/60'
                  }`}>
                  {trip.status}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-3 text-sm">
                <span className="flex items-center gap-1.5 text-xs font-medium text-[#EAE0C8]/50">
                  <span>Time</span>
                  {trip.created_at?.toDate ? trip.created_at.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                </span>
                {trip.circle_type && (
                  <span className="rounded-md bg-blue-500/10 px-2 py-1 text-xs font-semibold tracking-wide text-blue-300/80">
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
