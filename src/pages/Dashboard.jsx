import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Link } from 'react-router-dom';
import Header from '../components/Layout/Header';
import Navigation from '../components/Layout/Navigation';

export default function Dashboard() {
  const { user, userData, loading: authLoading } = useAuth();
  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(true);

  // Display name immediately - fallback to displayName if userData not ready yet
  const displayName = userData?.name || user?.displayName || 'User';

  // Set up real-time trips listener
  useEffect(() => {
    if (!user) {
      setTripsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'trips'),
      where('user_id', '==', user.uid),
      where('status', 'in', ['pending', 'active'])
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setTrips(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setTripsLoading(false);
      },
      (error) => {
        console.error('Trips fetch error:', error);
        setTripsLoading(false);
      }
    );

    return unsub;
  }, [user]);

  // Only show loading screen if auth is still initializing on first load
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-300 border-t-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B132B] flex flex-col font-sans text-[#eae0c8] relative">
      {/* Subtle cinematic background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none z-0"></div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 container-max px-4 py-6 pb-32 max-w-md mx-auto w-full">

          {/* Welcome Section */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-white/10 rounded-[2rem] p-8 mb-6 shadow-2xl">
            <h1 className="text-3xl font-extrabold mb-2 tracking-tight text-[#eae0c8]">
              Welcome, {displayName.split(' ')[0]}! 👋
            </h1>
            <p className="text-blue-200/80 font-medium leading-relaxed">
              {userData?.verification_status === 'VERIFIED'
                ? '✅ Verified member — ready to walk safely!'
                : '⏳ Please complete verification to start trip matching.'}
            </p>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Reputation', value: userData?.reputation_score || 0, color: 'text-blue-400' },
              { label: 'Safe Trips', value: userData?.successful_trips || 0, color: 'text-green-400' },
              { label: 'Active Trips', value: trips.length, color: 'text-[#eae0c8]' },
            ].map((stat, idx) => (
              <div key={idx} className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-[1.5rem] shadow-lg p-5 text-center flex flex-col justify-center items-center">
                <div className={`text-2xl font-bold ${stat.color} drop-shadow-md`}>
                  {stat.value}
                </div>
                <div className="text-[#9CA3AF] text-xs mt-2 font-semibold tracking-wide uppercase">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-[2rem] shadow-xl p-7 mb-8">
            <h2 className="font-bold text-[#eae0c8] mb-5 text-lg tracking-wide">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
              <Link to="/create-trip" className="flex flex-col items-center justify-center bg-blue-500/10 hover:bg-blue-500/20 border border-blue-400/20 text-blue-300 rounded-[1.5rem] py-6 transition-all duration-300 group shadow-inner">
                <span className="text-3xl mb-3 group-hover:scale-110 group-hover:drop-shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all">📍</span>
                <span className="font-bold text-sm tracking-wide">New Trip</span>
              </Link>
              {userData?.verification_status !== 'VERIFIED' && (
                <Link to="/verify" className="flex flex-col items-center justify-center bg-green-500/10 hover:bg-green-500/20 border border-green-400/20 text-green-300 rounded-[1.5rem] py-6 transition-all duration-300 group shadow-inner">
                  <span className="text-3xl mb-3 group-hover:scale-110 group-hover:drop-shadow-[0_0_10px_rgba(34,197,94,0.5)] transition-all">✓</span>
                  <span className="font-bold text-sm tracking-wide">Verify Me</span>
                </Link>
              )}
              <Link to="/profile" className="flex flex-col items-center justify-center bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/20 text-purple-300 rounded-[1.5rem] py-6 transition-all duration-300 group shadow-inner">
                <span className="text-3xl mb-3 group-hover:scale-110 group-hover:drop-shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-all">👤</span>
                <span className="font-bold text-sm tracking-wide">Profile</span>
              </Link>
            </div>
          </div>

          {/* Active Trips Section */}
          {tripsLoading ? (
            <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-[2rem] shadow-xl p-7">
              <h2 className="font-bold text-[#eae0c8] mb-5 text-lg tracking-wide">Active Trips</h2>
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white/5 border border-white/5 rounded-2xl p-5 animate-pulse">
                    <div className="h-4 bg-white/20 rounded w-3/4 mb-3"></div>
                    <div className="h-3 bg-white/10 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : trips.length > 0 ? (
            <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-[2rem] shadow-xl p-7">
              <h2 className="font-bold text-[#eae0c8] mb-5 text-lg tracking-wide">Active Trips</h2>
              <div className="space-y-4">
                {trips.map(trip => (
                  <div key={trip.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4 hover:bg-white/10 transition-colors shadow-inner">
                    <div>
                      <p className="font-bold text-[#eae0c8] text-lg mb-1 leading-tight">
                        {trip.origin_landmark} → {trip.destination_landmark}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="relative flex h-3 w-3">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${trip.status === 'pending' ? 'bg-orange-400' : 'bg-green-400'}`}></span>
                          <span className={`relative inline-flex rounded-full h-3 w-3 ${trip.status === 'pending' ? 'bg-orange-500' : 'bg-green-500'}`}></span>
                        </span>
                        <p className={`text-sm font-medium ${trip.status === 'pending' ? 'text-orange-300' : 'text-green-300'}`}>
                          {trip.status === 'pending' ? 'Finding verified circle...' : 'Circle matched!'}
                        </p>
                      </div>
                    </div>
                    {trip.circle_id && (
                      <Link to={`/circle/${trip.circle_id}`} className="w-full text-center bg-blue-600/90 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-500 hover:scale-[1.02] transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                        Join Live Circle
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="backdrop-blur-lg bg-white/5 border border-white/10 rounded-[2rem] shadow-xl p-10 text-center flex flex-col items-center justify-center">
              <div className="text-5xl mb-4 opacity-50 drop-shadow-md">🗺️</div>
              <p className="text-[#9CA3AF] font-medium leading-relaxed text-lg">No active trips yet.<br/><span className="text-[#eae0c8]/70">Start a safe journey today.</span></p>
            </div>
          )}

        </main>
        <Navigation />
      </div>
    </div>
  );
}
