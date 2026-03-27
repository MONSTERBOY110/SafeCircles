import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="text-gray-500 ml-3">Loading trips...</p>
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">No active trips</p>
        <p className="text-gray-500 text-sm mt-1">Create one to join a SafeCircle!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {trips.map(trip => (
        <div 
          key={trip.id} 
          className="border border-gray-200 rounded-xl p-5 bg-white hover:shadow-lg transition-all duration-200"
        >
          {/* Trip Header */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-gray-800">
                  {trip.origin_landmark} → {trip.destination_landmark}
                </h3>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-600">
                {trip.departure_window?.start && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>
                      {new Date(trip.departure_window.start).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                )}
                
                <span className={`px-3 py-1 rounded-full font-semibold text-xs ${
                  trip.status === 'pending' 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : trip.status === 'matched'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {trip.status === 'pending' 
                    ? '⏳ Searching' 
                    : trip.status === 'matched'
                    ? '✅ Circle Ready'
                    : '🛣️ Active'}
                </span>
              </div>
            </div>

            {trip.status === 'pending' && (
              <button
                onClick={() => handleDeleteTrip(trip.id)}
                disabled={deleting === trip.id}
                className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                title="Delete trip"
              >
                {deleting === trip.id ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </button>
            )}
          </div>

          {/* Circle Info */}
          {(trip.status === 'matched' || trip.status === 'active') && members[trip.id] && (
            <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-900">
                  {members[trip.id].length} member{members[trip.id].length !== 1 ? 's' : ''}
                </span>
              </div>
              
              <div className="space-y-2">
                {members[trip.id].map((member, index) => (
                  <div key={member.uid + index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <span className="text-gray-800">{member.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.verified && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Verified
                        </span>
                      )}
                      {member.reputation > 0 && (
                        <span className="text-xs text-gray-600">
                          ⭐ {member.reputation.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {trip.circle_id && (trip.status === 'matched' || trip.status === 'active') && (
              <Link 
                to={`/circle/${trip.circle_id}`} 
                className="flex-1 btn-primary text-center py-2 text-sm font-medium rounded-lg hover:opacity-90 transition"
              >
                View Circle →
              </Link>
            )}
            
            {trip.status === 'pending' && (
              <div className="flex-1 bg-gray-100 text-gray-600 text-center py-2 text-sm font-medium rounded-lg">
                Waiting for matches...
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
