import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { deleteTrip, getCircleMembers } from '../services/matching';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import Header from '../components/Layout/Header';
import Navigation from '../components/Layout/Navigation';
import { Loader2, MapPin, Users, ArrowRight, Clock, AlertCircle, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TripsPage() {
  const { user, loading: authLoading } = useAuth();

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState({});
  const [circles, setCircles] = useState({});
  const [showFallback, setShowFallback] = useState(false);
  const [retryingTripId, setRetryingTripId] = useState(null);
  const [confirmingDeleteTripId, setConfirmingDeleteTripId] = useState(null);
  const [deletingTripId, setDeletingTripId] = useState(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setTrips([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'trips'),
      where('userId', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const tripsData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTrips(tripsData);
        setLoading(false);
      },
      (error) => {
        console.error('Trips fetch error:', error);
        setLoading(false);
      }
    );

    return unsub;
  }, [user, authLoading]);

  useEffect(() => {
    const matchedTrips = trips.filter((t) => t.status === 'matched' && t.circle_id);

    if (matchedTrips.length === 0) return;

    matchedTrips.forEach((trip) => {
      if (!members[trip.id]) {
        fetchMembers(trip.id, trip.circle_id);
      }

      if (!circles[trip.circle_id]) {
        fetchCircle(trip.circle_id);
      }
    });
  }, [trips, members, circles]);

  const fetchMembers = async (tripId, circleId) => {
    try {
      const membersList = await getCircleMembers(circleId);
      setMembers((prev) => ({ ...prev, [tripId]: membersList }));
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const fetchCircle = async (circleId) => {
    try {
      const circleSnap = await getDoc(doc(db, 'safe_circles', circleId));
      if (!circleSnap.exists()) return;

      setCircles((prev) => ({
        ...prev,
        [circleId]: circleSnap.data(),
      }));
    } catch (error) {
      console.error('Error fetching circle:', error);
    }
  };

  const formatTime = (date) => {
    if (!date) return '';

    const value = typeof date?.toDate === 'function' ? date.toDate() : new Date(date);
    return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    if (!date) return '';

    const value = typeof date?.toDate === 'function' ? date.toDate() : new Date(date);
    return value.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const pendingTrips = trips.filter((t) => t.status === 'pending');
  const matchedTrips = trips.filter((t) => t.status === 'matched');
  const completedTrips = trips
    .filter((t) => t.status === 'completed')
    .sort((a, b) => {
      const aTs = a.completedAt?.toMillis?.() ?? (a.completedAt?.seconds ?? 0) * 1000;
      const bTs = b.completedAt?.toMillis?.() ?? (b.completedAt?.seconds ?? 0) * 1000;
      return bTs - aTs;
    })
    .slice(0, 5);
  const pendingTripKey = pendingTrips.map((trip) => trip.id).sort().join(',');

  useEffect(() => {
    if (pendingTrips.length > 0) {
      setShowFallback(false);
      const timer = setTimeout(() => {
        setShowFallback(true);
      }, 10000);

      return () => clearTimeout(timer);
    }

    setShowFallback(false);
  }, [pendingTripKey, pendingTrips.length]);

  const handleTryAgain = async (tripId) => {
    setRetryingTripId(tripId);

    try {
      await deleteTrip(tripId);
      toast.success('Pending trip removed. You can create a new one.');
    } catch (error) {
      console.error('Error retrying trip:', error);
      toast.error(error.message || 'Could not reset this trip');
    } finally {
      setRetryingTripId(null);
    }
  };

  const handleDeleteTrip = async (trip) => {
    if (!trip?.id) return;
    if (trip.userId !== user?.uid) return;
    if (trip.status !== 'pending') return;

    setDeletingTripId(trip.id);

    try {
      await deleteDoc(doc(db, 'trips', trip.id));
      setTrips((prev) => prev.filter((item) => item.id !== trip.id));
      setConfirmingDeleteTripId(null);
      toast.success('Trip deleted successfully');
    } catch (error) {
      console.error('Error deleting trip:', error);
      toast.error('Failed to delete trip');
    } finally {
      setDeletingTripId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B132B] flex flex-col font-sans text-[#eae0c8] relative">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none z-0"></div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />

        <main className="flex-1 w-full px-4 py-6 pb-32 max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#EAE0C8] mb-2">Your Trips</h1>
            <p className="text-[#EAE0C8]/50">Track your pending and matched SafeCircle trips</p>
          </div>

          {loading || authLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mr-3" />
              <span className="text-[#EAE0C8]/50">Loading trips...</span>
            </div>
          ) : trips.length === 0 ? (
            <div className="backdrop-blur-xl bg-[#111A3A]/70 border border-white/5 rounded-[2rem] p-10 text-center shadow-2xl">
              <AlertCircle className="w-12 h-12 text-[#EAE0C8]/40 mx-auto mb-4" />
              <p className="text-xl font-semibold text-[#EAE0C8]">No trips yet. Create one from dashboard.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {pendingTrips.length > 0 && (
                <section className="space-y-4">
                  {pendingTrips.map((trip) => (
                    <div
                      key={trip.id}
                      className="backdrop-blur-xl bg-blue-500/10 border border-blue-400/20 rounded-[2rem] p-6 shadow-2xl"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-400/25 flex items-center justify-center shrink-0">
                          <Loader2 className="w-6 h-6 text-blue-300 animate-spin" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h2 className="text-xl font-extrabold text-[#EAE0C8]">Finding your SafeCircle...</h2>
                          <p className="text-sm text-[#EAE0C8]/60 mt-1">Matching nearby verified users</p>

                          {showFallback && (
                            <div className="mt-4 rounded-2xl border border-white/5 bg-[#0B132B]/50 p-4">
                              <p className="text-sm text-[#eae0c8]">No nearby users found yet. Still searching...</p>
                              <button
                                type="button"
                                onClick={() => handleTryAgain(trip.id)}
                                disabled={retryingTripId === trip.id}
                                className="mt-4 inline-flex items-center justify-center rounded-xl border border-white/5 bg-[#111A3A]/70 px-4 py-2 text-sm font-semibold text-[#EAE0C8] transition-all hover:bg-[#111A3A] disabled:opacity-50"
                              >
                                {retryingTripId === trip.id ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Retrying...
                                  </>
                                ) : (
                                  'Try Again'
                                )}
                              </button>
                            </div>
                          )}

                          <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <div className="bg-[#0B132B]/50 border border-white/5 rounded-2xl p-4">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-[#EAE0C8]/50 mb-2">Route</p>
                              <p className="text-sm text-[#EAE0C8] font-semibold truncate">{trip.origin_landmark}</p>
                              <div className="flex items-center gap-2 text-sm text-[#EAE0C8]/50 mt-1">
                                <ArrowRight className="w-4 h-4" />
                                <span className="truncate">{trip.destination_landmark}</span>
                              </div>
                            </div>

                            <div className="bg-[#0B132B]/50 border border-white/5 rounded-2xl p-4">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-[#EAE0C8]/50 mb-2">Departure Window</p>
                              <div className="flex items-center gap-2 text-sm text-[#EAE0C8]">
                                <Clock className="w-4 h-4 text-blue-300" />
                                <span>{formatDate(trip.departure_window?.start)} at {formatTime(trip.departure_window?.start)}</span>
                              </div>
                            </div>
                          </div>

                          {trip.userId === user?.uid && trip.status === 'pending' && (
                            <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                              {confirmingDeleteTripId === trip.id ? (
                                <div className="space-y-3">
                                  <p className="text-sm font-medium text-red-200">
                                    Are you sure you want to delete this trip?
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTrip(trip)}
                                      disabled={deletingTripId === trip.id}
                                      className="inline-flex items-center justify-center rounded-xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/30 disabled:opacity-50"
                                    >
                                      {deletingTripId === trip.id ? (
                                        <>
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          Deleting...
                                        </>
                                      ) : (
                                        'Confirm Delete'
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmingDeleteTripId(null)}
                                      disabled={deletingTripId === trip.id}
                                      className="inline-flex items-center justify-center rounded-xl border border-white/5 bg-[#111A3A]/70 px-4 py-2 text-sm font-semibold text-[#EAE0C8]/70 transition hover:bg-[#111A3A] disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmingDeleteTripId(trip.id)}
                                  disabled={deletingTripId === trip.id}
                                  className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                                >
                                  {deletingTripId === trip.id ? 'Deleting...' : 'Delete Trip'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </section>
              )}

              {matchedTrips.length > 0 && (
                <section className="space-y-4">
                  {matchedTrips.map((trip) => {
                    const tripMembers = members[trip.id] || [];
                    const circle = circles[trip.circle_id];

                    return (
                      <div
                        key={trip.id}
                        className="backdrop-blur-xl bg-[#111A3A]/70 border border-blue-500/20 rounded-[2rem] p-6 shadow-2xl"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h2 className="text-xl font-extrabold text-[#EAE0C8]">SafeCircle matched</h2>
                            <p className="text-sm text-[#EAE0C8]/60 mt-1">
                              {trip.origin_landmark} <span className="text-[#EAE0C8]/40 mx-2">to</span> {trip.destination_landmark}
                            </p>
                          </div>

                          <div className="px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/25 text-blue-300 text-xs font-semibold uppercase tracking-[0.2em]">
                            Matched
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                          <div className="bg-[#0B132B]/50 border border-white/5 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Users className="w-5 h-5 text-blue-300" />
                              <p className="text-sm font-semibold text-[#EAE0C8]">Members</p>
                            </div>

                            {tripMembers.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {tripMembers.map((member) => (
                                  <span
                                    key={member.uid}
                                    className="px-3 py-2 rounded-xl bg-[#111A3A]/70 border border-white/5 text-sm text-[#eae0c8]"
                                  >
                                    {member.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm text-[#EAE0C8]/50">
                                <Search className="w-4 h-4" />
                                <span>Loading members...</span>
                              </div>
                            )}
                          </div>

                          <div className="bg-[#0B132B]/50 border border-white/5 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <MapPin className="w-5 h-5 text-blue-300" />
                              <p className="text-sm font-semibold text-[#EAE0C8]">Meeting Point</p>
                            </div>

                            <p className="text-sm text-[#eae0c8]">
                              {circle?.meeting_point?.name || 'Loading meeting point...'}
                            </p>

                            <Link
                              to={`/circle/${trip.circle_id}`}
                              className="mt-5 inline-flex w-full items-center justify-center gap-2 bg-blue-600 text-[#EAE0C8] font-extrabold text-sm py-3 rounded-xl hover:bg-blue-500 transition-all"
                            >
                              View Circle
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}

              {completedTrips.length > 0 && (
                <section className="space-y-4">
                  <h2 className="text-sm font-bold text-[#EAE0C8]/60 uppercase tracking-[0.2em] mt-6 mb-2">
                    Past Trips
                  </h2>
                  {completedTrips.map((trip) => (
                    <div
                      key={trip.id}
                      className="backdrop-blur-xl bg-[#111A3A]/50 border border-white/5 rounded-[1.5rem] p-5 shadow-lg opacity-90"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[#EAE0C8] text-sm font-semibold truncate">
                            {trip.origin_landmark || trip.origin}
                          </p>
                          <p className="text-[#EAE0C8]/50 text-xs mt-1 truncate">
                            <span className="text-[#EAE0C8]/30">to</span> {trip.destination_landmark || trip.destination}
                          </p>
                        </div>
                        <span className="shrink-0 inline-flex items-center gap-1.5 bg-green-500/10 text-green-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-500/20 uppercase tracking-wider">
                          Completed
                        </span>
                      </div>
                      {trip.completedAt && (
                        <p className="text-[#EAE0C8]/40 text-xs mt-3">
                          {formatDate(trip.completedAt)} · {formatTime(trip.completedAt)}
                        </p>
                      )}
                    </div>
                  ))}
                </section>
              )}
            </div>
          )}
        </main>

        <Navigation />
      </div>
    </div>
  );
}
