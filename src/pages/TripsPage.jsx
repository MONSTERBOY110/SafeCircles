import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { deleteTrip, getCircleMembers } from '../services/matching';
import { Link } from 'react-router-dom';
import Header from '../components/Layout/Header';
import Navigation from '../components/Layout/Navigation';
import { Trash2, MapPin, Clock, Users, AlertCircle, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState({});
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'trips'),
      where('user_id', '==', user.uid),
      where('status', 'in', ['pending', 'active', 'matched'])
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const tripsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTrips(tripsData);
        setLoading(false);
        
        // Fetch members for matched/active trips
        tripsData.forEach(trip => {
          if ((trip.status === 'matched' || trip.status === 'active') && trip.circle_id) {
            fetchMembers(trip.id, trip.circle_id);
          }
        });
      },
      (error) => {
        console.error('❌ Trips fetch error:', error);
        setLoading(false);
      }
    );

    return unsub;
  }, []);

  const fetchMembers = async (tripId, circleId) => {
    try {
      const membersList = await getCircleMembers(circleId);
      setMembers(prev => ({ ...prev, [tripId]: membersList }));
    } catch (error) {
      console.error('❌ Error fetching members:', error);
    }
  };

  const handleDeleteTrip = async (tripId) => {
    if (!window.confirm('Are you sure you want to delete this trip?')) {
      return;
    }

    setDeleting(tripId);
    try {
      await deleteTrip(tripId);
      toast.success('Trip deleted successfully');
      setTrips(trips.filter(t => t.id !== tripId));
    } catch (error) {
      console.error('❌ Delete error:', error);
      toast.error(error.message || 'Failed to delete trip');
    } finally {
      setDeleting(null);
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const pendingTrips = trips.filter(t => t.status === 'pending');
  const matchedTrips = trips.filter(t => t.status === 'matched' || t.status === 'active');

  return (
    <div className="min-h-screen bg-[#0B132B] flex flex-col font-sans text-[#eae0c8]">
      <Header />
      
      <main className="flex-1 w-full px-4 py-6 pb-32 max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Your Trips</h1>
          <p className="text-gray-400">Manage your SafeCircle trips and companions</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mr-3" />
            <span className="text-gray-400">Loading trips...</span>
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-gray-700">
            <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No active trips</p>
            <p className="text-gray-500 text-sm mt-1 mb-4">Create one to join a SafeCircle!</p>
            <Link to="/create-trip" className="btn-primary inline-block">
              Create Trip
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Matched/Active Trips */}
            {matchedTrips.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  Your SafeCircles
                </h2>
                <div className="space-y-4">
                  {matchedTrips.map(trip => (
                    <div 
                      key={trip.id}
                      className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-700/50 rounded-xl p-6 hover:border-green-600 transition-all"
                    >
                      {/* Route */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <MapPin className="w-5 h-5 text-green-400" />
                            <div>
                              <p className="font-bold text-white text-lg">
                                {trip.origin_landmark}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                                <ArrowRight className="w-4 h-4" />
                                <span>{trip.destination_landmark}</span>
                              </div>
                            </div>
                          </div>

                          {/* Time */}
                          <div className="flex items-center gap-2 text-sm text-gray-400 ml-7">
                            <Clock className="w-4 h-4" />
                            <span>
                              {formatDate(trip.departure_window?.start)} at {formatTime(trip.departure_window?.start)}
                            </span>
                          </div>
                        </div>

                        <span className="bg-green-600/30 text-green-300 px-3 py-1 rounded-full text-xs font-semibold border border-green-500/50 whitespace-nowrap ml-4">
                          ✅ {trip.status === 'matched' ? 'Circle Ready' : 'Active'}
                        </span>
                      </div>

                      {/* Members */}
                      {members[trip.id] && (
                        <div className="bg-black/30 rounded-lg p-4 mb-4 border border-gray-700">
                          <div className="flex items-center gap-2 mb-3">
                            <Users className="w-5 h-5 text-blue-400" />
                            <span className="font-semibold text-white">
                              {members[trip.id].length} member{members[trip.id].length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            {members[trip.id].map((member, index) => (
                              <div key={member.uid + index} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                  <span className="text-gray-200">{member.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {member.verified && (
                                    <span className="text-xs bg-blue-600/50 text-blue-300 px-2 py-1 rounded border border-blue-500/50">
                                      ✓ Verified
                                    </span>
                                  )}
                                  {member.reputation > 0 && (
                                    <span className="text-xs text-gray-400">
                                      ⭐ {member.reputation.toFixed(1)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action */}
                      {trip.circle_id && (
                        <Link 
                          to={`/circle/${trip.circle_id}`}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition text-center block"
                        >
                          View Full Circle →
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Pending Trips */}
            {pendingTrips.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Clock className="w-6 h-6 text-yellow-500" />
                  Finding Companions ({pendingTrips.length})
                </h2>
                <div className="space-y-4">
                  {pendingTrips.map(trip => (
                    <div 
                      key={trip.id}
                      className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-700/50 rounded-xl p-6 hover:border-yellow-600 transition-all"
                    >
                      {/* Route */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <MapPin className="w-5 h-5 text-yellow-400" />
                            <div>
                              <p className="font-bold text-white text-lg">
                                {trip.origin_landmark}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                                <ArrowRight className="w-4 h-4" />
                                <span>{trip.destination_landmark}</span>
                              </div>
                            </div>
                          </div>

                          {/* Time */}
                          <div className="flex items-center gap-2 text-sm text-gray-400 ml-7">
                            <Clock className="w-4 h-4" />
                            <span>
                              {formatDate(trip.departure_window?.start)} at {formatTime(trip.departure_window?.start)}
                            </span>
                          </div>
                        </div>

                        <span className="bg-yellow-600/30 text-yellow-300 px-3 py-1 rounded-full text-xs font-semibold border border-yellow-500/50 whitespace-nowrap ml-4 animate-pulse">
                          ⏳ Searching
                        </span>
                      </div>

                      {/* Info */}
                      <p className="text-sm text-gray-400 mb-4 text-center">
                        Waiting for verified companions with matching location...
                      </p>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteTrip(trip.id)}
                          disabled={deleting === trip.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-600/50 rounded-lg py-2 transition disabled:opacity-50"
                        >
                          {deleting === trip.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Deleting...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4" />
                              <span>Delete Trip</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <Navigation />
    </div>
  );
}
