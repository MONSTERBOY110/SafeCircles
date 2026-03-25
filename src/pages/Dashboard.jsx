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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 container-max py-10 pb-24 md:pb-10">

        {/* Welcome Section - Shows name instantly */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-8 mb-8">
          <h1 className="text-4xl font-bold mb-1">
            Welcome, {displayName.split(' ')[0]}! 👋
          </h1>
          <p className="text-blue-200">
            {userData?.verification_status === 'VERIFIED'
              ? '✅ Verified member — ready to walk safely!'
              : '⏳ Please complete verification to start trip matching.'}
          </p>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Reputation', value: userData?.reputation_score || 0, color: 'text-blue-600' },
            { label: 'Safe Trips', value: userData?.successful_trips || 0, color: 'text-green-600' },
            { label: 'Active Trips', value: trips.length, color: 'text-orange-600' },
          ].map((stat, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow p-5 text-center">
              <div className={`text-3xl font-bold ${stat.color}`}>
                {stat.value}
              </div>
              <div className="text-gray-500 text-xs mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow p-6 mb-8">
          <h2 className="font-bold text-gray-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/create-trip" className="btn-primary text-center py-3">
              ➕ New Trip
            </Link>
            {userData?.verification_status !== 'VERIFIED' && (
              <Link to="/verify" className="btn-secondary text-center py-3">
                ✅ Verify Me
              </Link>
            )}
            <Link to="/profile" className="btn-secondary text-center py-3">
              👤 Profile
            </Link>
          </div>
        </div>

        {/* Active Trips Section */}
        {tripsLoading ? (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-bold text-gray-800 mb-4">Active Trips</h2>
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        ) : trips.length > 0 ? (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-bold text-gray-800 mb-4">Active Trips</h2>
            <div className="space-y-3">
              {trips.map(trip => (
                <div key={trip.id} className="border border-gray-200 rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {trip.origin_landmark} → {trip.destination_landmark}
                    </p>
                    <p className="text-sm text-gray-500">
                      {trip.status === 'pending' ? '⏳ Finding circle...' : '✅ Circle found!'}
                    </p>
                  </div>
                  {trip.circle_id && (
                    <Link to={`/circle/${trip.circle_id}`} className="text-blue-600 font-bold text-sm hover:underline">
                      Join →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow p-6 text-center">
            <p className="text-gray-500">No active trips yet. Create one to get started!</p>
          </div>
        )}

      </main>
      <Navigation />
    </div>
  );
}
