import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';

export default function CreateTrip() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  // Fetch all trips for user history (preserves Firebase frontend logic patterns)
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
      const fetchedTrips = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort newest first safely
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

  const activeTrips = trips.filter(t => t.status === 'pending' || t.status === 'active');
  const pastTrips = trips.filter(t => t.status === 'completed' || t.status === 'cancelled');
  const displayedTrips = activeTab === 'active' ? activeTrips : pastTrips;

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6">
      <h2 className="text-3xl font-extrabold mb-6 text-[#eae0c8] tracking-tight">Your Trips</h2>

      {/* Tabs */}
      <div className="flex bg-[#111A3A]/80 backdrop-blur-md rounded-2xl p-1 mb-6 border border-white/10 shadow-lg">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'active' ? 'bg-blue-600/90 text-white shadow-md' : 'text-[#9CA3AF] hover:text-[#eae0c8]'}`}
        >
          Active Trips
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'past' ? 'bg-blue-600/90 text-white shadow-md' : 'text-[#9CA3AF] hover:text-[#eae0c8]'}`}
        >
          Past Trips
        </button>
      </div>

      {/* Trips List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-10 opacity-50">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-[#eae0c8] font-medium tracking-wide">Loading trips...</p>
          </div>
        ) : displayedTrips.length === 0 ? (
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[2rem] shadow-xl p-10 text-center flex flex-col items-center justify-center mt-8">
            <div className="text-5xl mb-4 opacity-50 drop-shadow-md">🚙</div>
            <p className="text-[#9CA3AF] font-medium leading-relaxed text-lg">No {activeTab} trips yet.</p>
          </div>
        ) : (
          displayedTrips.map(trip => (
            <div key={trip.id} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[1.5rem] shadow-xl p-5 flex flex-col gap-3 hover:bg-white/10 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0 shadow-[0_0_8px_rgba(96,165,250,0.8)]"></span>
                    <h3 className="text-[#eae0c8] font-bold text-base leading-tight truncate">{trip.origin_landmark || 'Unknown Origin'}</h3>
                  </div>
                  <div className="w-[2px] h-3 bg-white/10 ml-[4px] my-1 rounded-full"></div>
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 bg-red-400 shrink-0 shadow-[0_0_8px_rgba(248,113,113,0.8)] transform rotate-45"></span>
                    <h3 className="text-[#eae0c8] font-bold text-base leading-tight truncate">{trip.destination_landmark || 'Unknown Destination'}</h3>
                  </div>
                </div>
                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest shrink-0 ${trip.status === 'pending' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                    trip.status === 'active' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                      trip.status === 'completed' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                        'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                  }`}>
                  {trip.status}
                </span>
              </div>

              <div className="mt-2 pt-3 border-t border-white/5 flex justify-between items-center text-sm">
                <span className="text-[#9CA3AF] font-medium text-xs flex items-center gap-1.5">
                  <span className="opacity-70">🕒</span>
                  {trip.created_at?.toDate ? trip.created_at.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                </span>
                {trip.circle_type && (
                  <span className="text-blue-300/80 text-xs font-semibold tracking-wide bg-blue-900/40 px-2 py-1 rounded-md">
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
