import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Link } from 'react-router-dom';
import Header from '../components/Layout/Header';
import Navigation from '../components/Layout/Navigation';

export default function Dashboard() {
  const { user, userData } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-500 animate-pulse">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 container-max py-10 pb-24 md:pb-10">

        {/* Welcome */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-8 mb-8">
          <h1 className="text-4xl font-bold mb-1">
            Welcome, {userData?.name?.split(' ')[0] || 'User'}! 👋
          </h1>
          <p className="text-blue-200">
            {userData?.verification_status === 'VERIFIED'
              ? '✅ Verified member — ready to walk safely!'
              : '⏳ Please complete verification to start trip matching.'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Reputation', value: userData?.reputation_score || 0, color: 'text-blue-600' },
            { label: 'Safe Trips', value: userData?.successful_trips || 0, color: 'text-green-600' },
            { label: 'Active Trips', value: trips.length, color: 'text-orange-600' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl shadow p-5 text-center">
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
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

        {/* Active Trips */}
        {trips.length > 0 && (
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
                      Open →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <Navigation />
    </div>
  );
}
