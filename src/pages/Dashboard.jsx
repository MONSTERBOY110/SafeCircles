import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Link } from 'react-router-dom';
import Header from '../components/Layout/Header';
import Navigation from '../components/Layout/Navigation';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';

// Component to dynamically center map
function LocationMarker({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, map.getZoom(), { animate: true });
  }, [position, map]);
  
  return position ? (
    <Marker position={position}></Marker>
  ) : null;
}

export default function Dashboard() {
  const { user, userData, loading: authLoading } = useAuth();
  
  // Existing data logic preserved exactly as requested
  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(true);

  // New local state for inputs & map
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [userLocation, setUserLocation] = useState(null);

  const displayName = userData?.name || user?.displayName || 'User';

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

  // Geolocation effect
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => console.error("Error getting location:", error)
      );
    }
  }, []);

  const handleFindCircle = (e) => {
    e.preventDefault();
    console.log("Finding circle for:", { source, destination });
  };

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
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none z-0"></div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 w-full px-4 py-4 pb-32 max-w-md mx-auto flex flex-col">
          
          <div className="mb-6 px-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#eae0c8]">
              Welcome, {displayName.split(' ')[0]}
            </h1>
            <p className="text-[#9CA3AF] text-sm mt-1 font-medium tracking-wide">Ready for a safe journey?</p>
          </div>

          {userData?.verification_status !== 'VERIFIED' && (
            <div className="backdrop-blur-xl bg-orange-500/10 border border-orange-500/30 rounded-[1.5rem] p-5 mb-6 shadow-lg flex items-center justify-between">
              <div>
                <h3 className="text-orange-300 font-bold mb-1 text-lg">Complete Verification</h3>
                <p className="text-orange-200/70 text-xs font-medium">Verify your identity to start safe trips</p>
              </div>
              <Link to="/verify" className="bg-orange-500 hover:bg-orange-400 text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all text-sm shrink-0 hover:scale-105 hover:shadow-[0_0_15px_rgba(249,115,22,0.4)]">
                Verify Now
              </Link>
            </div>
          )}

          {/* Ride Booking Input Section */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-[2rem] p-5 mb-6 shadow-2xl z-20 relative">
            <div className="relative flex flex-col gap-3">
              <div className="absolute left-[23px] top-[1.8rem] bottom-[1.8rem] w-[2px] bg-white/10 rounded-full z-0"></div>
              
              <div className="relative z-10 flex items-center gap-4 bg-[#0B132B]/60 p-2 rounded-2xl w-full border border-white/5 focus-within:border-white/20 transition-all">
                <div className="w-4 h-4 ml-2 rounded-full bg-blue-400 shrink-0 shadow-[0_0_10px_rgba(96,165,250,0.8)] border-[3px] border-[#0B132B]"></div>
                <input 
                  type="text" 
                  value={source} 
                  onChange={(e) => setSource(e.target.value)} 
                  placeholder="Current Location" 
                  className="bg-transparent border-none outline-none text-[#eae0c8] font-medium text-lg w-full placeholder-[#9CA3AF]"
                />
              </div>

              <div className="relative z-10 flex items-center gap-4 bg-[#0B132B]/60 p-2 rounded-2xl w-full border border-white/5 focus-within:border-white/20 transition-all">
                <div className="w-4 h-4 ml-2 bg-red-400 shrink-0 shadow-[0_0_10px_rgba(248,113,113,0.8)] border-[3px] border-[#0B132B] transform rotate-45"></div>
                <input 
                  type="text" 
                  value={destination} 
                  onChange={(e) => setDestination(e.target.value)} 
                  placeholder="Where to?" 
                  className="bg-transparent border-none outline-none text-[#eae0c8] font-bold text-lg w-full placeholder-[#9CA3AF]"
                />
              </div>
            </div>

            <button onClick={handleFindCircle} className="mt-5 w-full bg-[#eae0c8] text-[#0B132B] font-extrabold text-lg py-4 rounded-[1.5rem] hover:bg-white hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(234,224,200,0.4)] transition-all duration-300 flex items-center justify-center">
              Find Safe Circle
            </button>
          </div>

          {/* Live Full Width Map Section */}
          <div className="w-full h-[55vh] rounded-[2rem] overflow-hidden border border-white/10 relative shadow-2xl bg-[#090E20] mt-auto">
            {userLocation ? (
              <MapContainer 
                center={userLocation} 
                zoom={14} 
                zoomControl={false}
                style={{ height: '100%', width: '100%', zIndex: 1 }}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                <LocationMarker position={userLocation} />
              </MapContainer>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/30 via-[#090E20] to-[#090E20]"></div>
                <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
                <div className="z-10 flex flex-col items-center opacity-70">
                  <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-blue-400 animate-spin mb-4"></div>
                  <p className="text-[#eae0c8] font-medium tracking-[0.2em] uppercase text-xs">Getting location...</p>
                </div>
              </div>
            )}
          </div>

        </main>
        <Navigation />
      </div>
    </div>
  );
}
