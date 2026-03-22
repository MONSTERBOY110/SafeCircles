import React, { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { useNavigate } from 'react-router-dom';
import { geohashEncode } from '../../utils/geohash';
import toast from 'react-hot-toast';

// Default locations for MVP -- Jadavpur area
const LOCATIONS = [
  { label: 'Jadavpur Metro Station', lat: 22.5561, lng: 88.3629 },
  { label: 'Girls Hostel, Rajendra Nagar', lat: 22.5450, lng: 88.3700 },
  { label: 'Jadavpur University Gate 1', lat: 22.4978, lng: 88.3714 },
  { label: 'Park Street', lat: 22.5538, lng: 88.3516 },
  { label: 'Gariahat Market', lat: 22.5133, lng: 88.3638 },
  { label: 'Salt Lake Sector V', lat: 22.5828, lng: 88.4312 },
];

export default function CreateTrip() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tripData, setTripData] = useState({
    origin: 'Jadavpur Metro Station',
    destination: 'Girls Hostel, Rajendra Nagar',
    departureTime: '20:00',
    circlePreference: 'women_only',
  });

  const handleChange = (e) => {
    setTripData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const resolveCoords = (landmark) => {
    const found = LOCATIONS.find(l => l.label === landmark);
    if (found) return { lat: found.lat, lng: found.lng };
    // Default fallback
    return { lat: 22.5561, lng: 88.3629 };
  };

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    setLoading(true);
    const user = auth.currentUser;
    if (!user) { toast.error('Not logged in'); return; }

    try {
      const [hours, minutes] = tripData.departureTime.split(':');
      const departure = new Date();
      departure.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      const arrival = new Date(departure.getTime() + 15 * 60000);

      const originCoords = resolveCoords(tripData.origin);
      const destCoords = resolveCoords(tripData.destination);

      const tripRef = await addDoc(collection(db, 'trips'), {
        user_id: user.uid,
        user_name: user.displayName || 'User',
        origin_landmark: tripData.origin,
        destination_landmark: tripData.destination,
        origin_coords: originCoords,
        dest_coords: destCoords,
        origin_geohash: geohashEncode(originCoords.lat, originCoords.lng, 7),
        dest_geohash: geohashEncode(destCoords.lat, destCoords.lng, 7),
        departure_window: { start: departure, end: arrival },
        circle_type: tripData.circlePreference,
        status: 'pending',
        circle_id: null,
        created_at: serverTimestamp(),
        expires_at: new Date(Date.now() + 90 * 60 * 1000),
      });

      toast.success('Trip created! Searching for a circle...');
      navigate(`/trip/${tripRef.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to create trip. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-3xl font-bold mb-1 text-gray-800">Create Your Trip</h2>
          <p className="text-gray-500 mb-8">Find verified women to walk with safely</p>

          <form onSubmit={handleCreateTrip} className="space-y-6">
            <div>
              <label className="block font-semibold mb-2 text-gray-700">From (Starting Point)</label>
              <select name="origin" value={tripData.origin} onChange={handleChange} className="input-field">
                {LOCATIONS.map(l => <option key={l.label}>{l.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-2 text-gray-700">To (Destination)</label>
              <select name="destination" value={tripData.destination} onChange={handleChange} className="input-field">
                {LOCATIONS.map(l => <option key={l.label}>{l.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-2 text-gray-700">Departure Time</label>
              <input
                type="time"
                name="departureTime"
                value={tripData.departureTime}
                onChange={handleChange}
                className="input-field"
                required
              />
              <p className="text-gray-400 text-xs mt-1">±15 minutes flexibility for matching</p>
            </div>

            <div>
              <label className="block font-semibold mb-2 text-gray-700">Circle Preference</label>
              <select name="circlePreference" value={tripData.circlePreference} onChange={handleChange} className="input-field">
                <option value="women_only">Women Only</option>
                <option value="mixed">Women + Verified Allies</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating trip...' : '🔍 Find My Circle'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
