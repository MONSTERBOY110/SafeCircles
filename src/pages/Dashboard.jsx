import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { findAndMatchTrips } from '../services/matching';
import { Link } from 'react-router-dom';
import Header from '../components/Layout/Header';
import Navigation from '../components/Layout/Navigation';
import { MapContainer, TileLayer, Marker, useMap, Circle } from 'react-leaflet';
import ngeohash from 'ngeohash';
import toast from 'react-hot-toast';
import { Users, ShieldCheck, Loader2 } from 'lucide-react';

function LocationMarker({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) map.setView(position, map.getZoom(), { animate: true });
  }, [position, map]);

  return position ? (
    <>
      <Marker position={position}></Marker>
      <Circle center={position} radius={500} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1 }} />
    </>
  ) : null;
}

export default function Dashboard() {
  const { user, userData, loading: authLoading, isVerified } = useAuth();

  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  const displayName = userData?.name || user?.displayName || 'User';
  console.log('[Dashboard] Firestore userData:', userData);
  console.log('[Dashboard] Verified status:', isVerified);
  const circleType = 'Women Only';

  useEffect(() => {
    if (!user) {
      setTripsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'trips'),
      where('userId', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const userTrips = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const activeTrips = userTrips.filter(
          (t) => t.status === 'pending' || t.status === 'active' || t.status === 'matched'
        );

        setTrips(activeTrips);
        setTripsLoading(false);
      },
      (error) => {
        console.error('Trips fetch error:', error);
        setTripsLoading(false);
      }
    );

    return unsub;
  }, [user]);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => console.error('Error getting location:', error),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  const handleCreateTrip = async (e) => {
    e.preventDefault();

    if (!isVerified) {
      toast.error('You must be verified to join a SafeCircle.');
      return;
    }

    if (trips.some((t) => t.status === 'pending' || t.status === 'matched')) {
      toast.error('You already have an active search.');
      return;
    }

    if (!source || !destination) {
      toast.error('Please enter both origin and destination.');
      return;
    }

    if (!userLocation) {
      toast.error('Locating you... please wait a moment.');
      return;
    }

    setIsSubmitting(true);

    try {
      const [originLat, originLng] = userLocation || [];
      const destinationLat = typeof originLat === 'number' ? originLat + 0.02 : null;
      const destinationLng = typeof originLng === 'number' ? originLng + 0.02 : null;
      const safeSource = source?.trim();
      const safeDestination = destination?.trim();
      const safeUserName = user?.displayName || 'User';

      if (
        typeof originLat !== 'number' ||
        typeof originLng !== 'number' ||
        typeof destinationLat !== 'number' ||
        typeof destinationLng !== 'number' ||
        !safeSource ||
        !safeDestination
      ) {
        toast.error('Trip details are incomplete. Please try again.');
        return;
      }

      const originHash = ngeohash.encode(originLat, originLng, 7);
      const destHash = ngeohash.encode(
        destinationLat,
        destinationLng,
        7
      );

      const now = new Date();
      const endWindow = new Date(now.getTime() + 15 * 60000);
      const createdAt = serverTimestamp();

      const tripData = {
        userId: user.uid,
        user_name: safeUserName,
        origin: safeSource,
        destination: safeDestination,
        origin_landmark: safeSource,
        destination_landmark: safeDestination,
        origin_coords: { lat: originLat, lng: originLng },
        dest_coords: { lat: destinationLat, lng: destinationLng },
        origin_geohash: originHash,
        dest_geohash: destHash,
        timeWindowStart: now,
        timeWindowEnd: endWindow,
        departure_window: {
          start: now,
          end: endWindow,
        },
        circleType,
        circle_type: circleType,
        status: 'pending',
        circle_id: null,
        isVerified: true,
        createdAt,
        created_at: createdAt,
        expires_at: new Date(Date.now() + 90 * 60 * 1000),
      };

      const tripRef = await addDoc(collection(db, 'trips'), tripData);
      const newTripId = tripRef.id;
      console.log(`Trip created with userId: ${user.uid}`);
      setShowPopup(true);
      setTimeout(() => {
        setShowPopup(false);
      }, 1500);

      const matchResult = await findAndMatchTrips(tripData, newTripId);

      setSource('');
      setDestination('');

      if (matchResult?.success) {
        toast.success(`SafeCircle formed! ${matchResult.memberCount} members`);
        console.log('Matching successful:', matchResult);
      } else {
        toast.success('Searching for verified companions...');
        console.log('No matches yet, trip in pending state');
      }
    } catch (error) {
      console.error('Error creating trip:', error);
      toast.error('Failed to create trip');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || tripsLoading) {
    return (
      <div className="min-h-screen bg-[#0B132B] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B132B] flex flex-col font-sans text-[#eae0c8] relative">
      {showPopup && (
        <div
          className="fixed top-6 right-6 z-50 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-green-400 shadow-lg backdrop-blur-md"
          style={{ animation: 'tripSuccessPopup 1500ms ease-in-out forwards' }}
        >
          Trip created successfully
        </div>
      )}
      <style>
        {`
          @keyframes tripSuccessPopup {
            0% {
              opacity: 0;
              transform: translateY(-10px);
            }
            12% {
              opacity: 1;
              transform: translateY(0);
            }
            82% {
              opacity: 1;
              transform: translateY(0);
            }
            100% {
              opacity: 0;
              transform: translateY(-10px);
            }
          }
        `}
      </style>
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none z-0"></div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 w-full px-4 py-4 pb-32 max-w-md mx-auto flex flex-col">
          <div className="mb-6 px-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#eae0c8]">
              Welcome, {displayName.split(' ')[0]}
            </h1>
            <p className="text-[#EAE0C8]/50 text-sm mt-1 font-medium tracking-wide">Ready for a safe journey?</p>
          </div>

          {!isVerified && (
            <div className="backdrop-blur-xl bg-[#111A3A]/70 border border-blue-500/20 rounded-[1.5rem] p-5 mb-6 shadow-lg flex items-center justify-between">
              <div>
                <h3 className="text-blue-300 font-bold mb-1 text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" /> Complete Verification
                </h3>
                <p className="text-[#EAE0C8]/60 text-xs font-medium">Verify your identity to start safe trips</p>
              </div>
              <Link to="/verify" className="bg-blue-600/90 hover:bg-blue-500 text-[#EAE0C8] font-bold py-2 px-4 rounded-xl shadow-md transition-all text-sm shrink-0 hover:scale-105">
                Verify Now
              </Link>
            </div>
          )}

          <form onSubmit={handleCreateTrip} className="backdrop-blur-xl bg-[#111A3A]/70 border border-white/5 rounded-[2rem] p-5 mb-6 shadow-2xl z-20 relative">
            <div className="relative flex flex-col gap-3">
              <div className="absolute left-[23px] top-[1.8rem] bottom-[1.8rem] w-[2px] bg-blue-500/20 rounded-full z-0"></div>

              <div className="relative z-10 flex items-center gap-4 bg-[#0B132B]/60 p-2 rounded-2xl w-full border border-white/5 focus-within:border-[#EAE0C8]/20 transition-all">
                <div className="w-4 h-4 ml-2 rounded-full bg-blue-400 shrink-0 shadow-[0_0_10px_rgba(96,165,250,0.5)] border-[3px] border-[#0B132B]"></div>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Current Location"
                  required
                  className="bg-transparent border-none outline-none text-[#eae0c8] font-medium text-lg w-full placeholder:text-[#EAE0C8]/40"
                />
              </div>

              <div className="relative z-10 flex items-center gap-4 bg-[#0B132B]/60 p-2 rounded-2xl w-full border border-white/5 focus-within:border-[#EAE0C8]/20 transition-all">
                <div className="w-4 h-4 ml-2 bg-blue-300 shrink-0 shadow-[0_0_10px_rgba(147,197,253,0.45)] border-[3px] border-[#0B132B] transform rotate-45"></div>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Where to?"
                  required
                  className="bg-transparent border-none outline-none text-[#eae0c8] font-bold text-lg w-full placeholder:text-[#EAE0C8]/40"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !isVerified}
              className="mt-4 w-full bg-blue-600 text-[#EAE0C8] font-extrabold text-base py-3.5 rounded-xl hover:bg-blue-500 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
              Find Safe Circle
            </button>
          </form>

          <div className="w-full h-[45vh] lg:h-[55vh] rounded-[2rem] overflow-hidden border border-white/5 relative shadow-2xl bg-[#111A3A] mt-auto">
            {userLocation ? (
              <MapContainer
                center={userLocation}
                zoom={15}
                zoomControl={false}
                style={{ height: '100%', width: '100%', zIndex: 1 }}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <LocationMarker position={userLocation} />
              </MapContainer>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/30 via-[#090E20] to-[#090E20]"></div>
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
