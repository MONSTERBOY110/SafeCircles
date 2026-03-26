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
    <div className="w-full max-w-md mx-auto px-4 py-6">
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[2rem] shadow-2xl p-8">
        <h2 className="text-3xl font-extrabold mb-2 text-[#eae0c8] tracking-tight">Create Your Trip</h2>
        <p className="text-[#9CA3AF] mb-8 font-medium">Find verified women to walk with safely</p>

        <form onSubmit={handleCreateTrip} className="space-y-6">
          <div>
            <label className="block font-bold mb-2 text-[#eae0c8] tracking-wide text-sm">From (Starting Point)</label>
            <select name="origin" value={tripData.origin} onChange={handleChange} className="w-full bg-[#111A3A]/80 border border-white/10 text-[#eae0c8] rounded-[1rem] p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none shadow-inner">
              {LOCATIONS.map(l => <option key={l.label} value={l.label} className="text-[#0B132B]">{l.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block font-bold mb-2 text-[#eae0c8] tracking-wide text-sm">To (Destination)</label>
            <select name="destination" value={tripData.destination} onChange={handleChange} className="w-full bg-[#111A3A]/80 border border-white/10 text-[#eae0c8] rounded-[1rem] p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none shadow-inner">
              {LOCATIONS.map(l => <option key={l.label} value={l.label} className="text-[#0B132B]">{l.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block font-bold mb-2 text-[#eae0c8] tracking-wide text-sm">Departure Time</label>
            <input
              type="time"
              name="departureTime"
              value={tripData.departureTime}
              onChange={handleChange}
              className="w-full bg-[#111A3A]/80 border border-white/10 text-[#eae0c8] rounded-[1rem] p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner [color-scheme:dark]"
              required
            />
            <p className="text-[#9CA3AF] text-xs mt-2 font-medium">±15 minutes flexibility for matching</p>
          </div>

          <div>
            <label className="block font-bold mb-2 text-[#eae0c8] tracking-wide text-sm">Circle Preference</label>
            <select name="circlePreference" value={tripData.circlePreference} onChange={handleChange} className="w-full bg-[#111A3A]/80 border border-white/10 text-[#eae0c8] rounded-[1rem] p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none shadow-inner">
              <option value="women_only" className="text-[#0B132B]">Women Only</option>
              <option value="mixed" className="text-[#0B132B]">Women + Verified Allies</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600/90 text-white font-bold text-lg py-4 rounded-[1.5rem] hover:bg-blue-500 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none mt-4"
          >
            {loading ? 'Creating trip...' : '🔍 Find My Circle'}
          </button>
        </form>
      </div>
    </div>
  );
}
