import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { deleteTrip, getCircleMembers } from '../../services/matching';
import { Link } from 'react-router-dom';
import { Trash2, MapPin, Clock, Users, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TripList() {
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
        const tripsData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTrips(tripsData);
        setLoading(false);

        tripsData.forEach((trip) => {
          if ((trip.status === 'matched' || trip.status === 'active') && trip.circle_id) {
            fetchMembers(trip.id, trip.circle_id);
          }
        });
      },
      () => setLoading(false)
    );

    return unsub;
  }, []);

  const fetchMembers = async (tripId, circleId) => {
    try {
      const membersList = await getCircleMembers(circleId);
      setMembers((prev) => ({ ...prev, [tripId]: membersList }));
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const handleDeleteTrip = async (tripId) => {
    if (!window.confirm('Are you sure you want to delete this trip?')) return;

    setDeleting(tripId);
    try {
      await deleteTrip(tripId);
      toast.success('Trip deleted successfully');
      setTrips(trips.filter((t) => t.id !== tripId));
    } catch (error) {
      toast.error(error.message || 'Failed to delete trip');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
        <p className="ml-3 text-[#EAE0C8]/50">Loading trips...</p>
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-[#111A3A]/70 py-12 text-center">
        <AlertCircle className="mx-auto mb-3 h-12 w-12 text-[#EAE0C8]/50" />
        <p className="font-medium text-[#EAE0C8]/70">No active trips</p>
        <p className="mt-1 text-sm text-[#EAE0C8]/50">Create one to join a SafeCircle.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {trips.map((trip) => (
        <div
          key={trip.id}
          className="rounded-xl border border-white/5 bg-[#111A3A]/70 p-5 transition-all duration-200 hover:shadow-lg"
        >
          <div className="mb-4 flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-400" />
                <h3 className="font-bold text-[#EAE0C8]">
                  {trip.origin_landmark} to {trip.destination_landmark}
                </h3>
              </div>

              <div className="flex items-center gap-4 text-sm text-[#EAE0C8]/60">
                {trip.departure_window?.start && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>
                      {new Date(trip.departure_window.start).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                )}

                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${trip.status === 'pending'
                  ? 'bg-blue-500/10 text-blue-300'
                  : trip.status === 'matched'
                    ? 'bg-green-500/10 text-green-300'
                    : 'bg-blue-500/10 text-blue-300'
                  }`}>
                  {trip.status === 'pending'
                    ? 'Searching'
                    : trip.status === 'matched'
                      ? 'Circle Ready'
                      : 'Active'}
                </span>
              </div>
            </div>

            {trip.status === 'pending' && (
              <button
                onClick={() => handleDeleteTrip(trip.id)}
                disabled={deleting === trip.id}
                className="ml-4 rounded-lg p-2 text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                title="Delete trip"
              >
                {deleting === trip.id ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-red-400"></div>
                ) : (
                  <Trash2 className="h-5 w-5" />
                )}
              </button>
            )}
          </div>

          {(trip.status === 'matched' || trip.status === 'active') && members[trip.id] && (
            <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-400" />
                <span className="font-semibold text-[#EAE0C8]">
                  {members[trip.id].length} member{members[trip.id].length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2">
                {members[trip.id].map((member, index) => (
                  <div key={member.uid + index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-400"></div>
                      <span className="text-[#EAE0C8]">{member.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.verified && (
                        <span className="rounded bg-green-500/10 px-2 py-1 text-xs text-green-300">
                          Verified
                        </span>
                      )}
                      {member.reputation > 0 && (
                        <span className="text-xs text-[#EAE0C8]/60">
                          {member.reputation.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {trip.circle_id && (trip.status === 'matched' || trip.status === 'active') && (
              <Link
                to={`/circle/${trip.circle_id}`}
                className="btn-primary flex-1 rounded-lg py-2 text-center text-sm font-medium transition hover:opacity-90"
              >
                View Circle
              </Link>
            )}

            {trip.status === 'pending' && (
              <div className="flex-1 rounded-lg bg-[#0B132B]/60 py-2 text-center text-sm font-medium text-[#EAE0C8]/60">
                Waiting for matches...
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
