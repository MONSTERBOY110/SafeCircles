import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { findAndMatchTrips } from '../services/matching';
import { Link } from 'react-router-dom';
import Header from '../components/Layout/Header';
import Navigation from '../components/Layout/Navigation';
import { MapContainer, TileLayer, Marker, useMap, Circle } from 'react-leaflet';
import ngeohash from 'ngeohash';
import toast from 'react-hot-toast';
import { Search, MapPin, Users, ShieldCheck, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

// Component to dynamically center map
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
  const { user, userData, loading: authLoading } = useAuth();
  
  const [trips, setTrips] = useState([]);
  const [safeCircle, setSafeCircle] = useState(null);
  const [tripsLoading, setTripsLoading] = useState(true);

  // New local state for inputs & map
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [circleType, setCircleType] = useState('Mixed');
  const [userLocation, setUserLocation] = useState(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingWaitTime, setPendingWaitTime] = useState(0);

  const displayName = userData?.name || user?.displayName || 'User';
  const isVerified = userData?.verification_status === 'VERIFIED';

  useEffect(() => {
    if (!user) {
      setTripsLoading(false);
      return;
    }

    // Query trips using correct field name: user_id
    const q = query(
      collection(db, 'trips'),
      where('user_id', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const userTrips = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Only care about pending, matched or active trips for dashboard UI
        const activeTrips = userTrips.filter(
            t => t.status === 'pending' || t.status === 'active' || t.status === 'matched'
        );
        setTrips(activeTrips);
        setTripsLoading(false);

        // If matched or active, fetch the circle
        const matchedTrip = activeTrips.find(
            t => t.status === 'active' || t.status === 'matched'
        );
        if (matchedTrip?.circle_id) {
          fetchCircle(matchedTrip.circle_id);
        } else {
          setSafeCircle(null);
        }
      },
      (error) => {
        console.error('Trips fetch error:', error);
        setTripsLoading(false);
      }
    );

    return unsub;
  }, [user]);

  // Handle pending state timeout
  useEffect(() => {
    let interval;
    const pendingTrip = trips.find(t => t.status === 'pending');
    if (pendingTrip) {
      interval = setInterval(() => {
        setPendingWaitTime(prev => prev + 1);
      }, 1000);
    } else {
      setPendingWaitTime(0);
    }
    return () => clearInterval(interval);
  }, [trips]);

  const fetchCircle = async (circleId) => {
    try {
      const circleDoc = await getDoc(doc(db, 'safe_circles', circleId));
      if (circleDoc.exists()) {
        const circleData = circleDoc.data();
        
        // Fetch member details using correct field name: member_ids
        const memberPromises = (circleData.member_ids || []).map(async (uid) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (userSnap.exists()) {
              const ut = userSnap.data();
              return { uid, name: ut.name || 'User', reputation: ut.reputation_score || 0 };
            }
          } catch (err) {
            console.error('Error fetching member details:', err);
          }
          return { uid, name: 'User', reputation: 0 };
        });
        
        const membersList = await Promise.all(memberPromises);
        setSafeCircle({ id: circleDoc.id, ...circleData, memberDetails: membersList });
      }
    } catch (e) {
      console.error('Error fetching safe circle:', e);
    }
  };

  // Geolocation effect
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => console.error("Error getting location:", error),
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
    if (trips.some(t => t.status === 'pending' || t.status === 'matched')) {
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
      // Create Geohashes with precision 7 (matching createTrip service)
      const originHash = ngeohash.encode(userLocation[0], userLocation[1], 7);

      // For demo: destination slightly offset. In production -> geocode to real lat/lng.
      const destHash = ngeohash.encode(
          userLocation[0] + 0.02,
          userLocation[1] + 0.02,
          7
      );

      const now = new Date();
      const endWindow = new Date(now.getTime() + 15 * 60000); // +15 mins

      // Match field names from createTrip service
      const tripData = {
        user_id: user.uid,
        user_name: user.displayName || 'User',
        origin_landmark: source,
        destination_landmark: destination,
        origin_coords: { lat: userLocation[0], lng: userLocation[1] },
        dest_coords: {lat: userLocation[0] + 0.02, lng: userLocation[1] + 0.02},
        origin_geohash: originHash,
        dest_geohash: destHash,
        departure_window: {
          start: now,
          end: endWindow,
        },
        circle_type: circleType,
        status: 'pending',
        circle_id: null,
        isVerified: true,
        created_at: serverTimestamp(),
        expires_at: new Date(Date.now() + 90 * 60 * 1000),
      };

      const tripRef = await addDoc(collection(db, 'trips'), tripData);
      const newTripId = tripRef.id;
      console.log('✅ Trip created successfully:', newTripId);

      // FRONTEND MATCHING: Find matches and create circle
      console.log('🔍 Starting frontend matching...');
      const matchResult = await findAndMatchTrips(tripData, newTripId);

      setSource('');
      setDestination('');

      if (matchResult?.success) {
        toast.success(
            `🎉 SafeCircle formed! ${matchResult.memberCount} members`
        );
        console.log('✅ Matching successful:', matchResult);
      } else {
        toast.success('Searching for verified companions...');
        console.log(
            '⏳ No matches yet, trip in pending state'
        );
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

  const pendingTrip = trips.find(t => t.status === 'pending');
  const matchedTrip = trips.find(t => t.status === 'matched');

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

          {!isVerified && (
            <div className="backdrop-blur-xl bg-orange-500/10 border border-orange-500/30 rounded-[1.5rem] p-5 mb-6 shadow-lg flex items-center justify-between">
              <div>
                <h3 className="text-orange-300 font-bold mb-1 text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" /> Complete Verification
                </h3>
                <p className="text-orange-200/70 text-xs font-medium">Verify your identity to start safe trips</p>
              </div>
              <Link to="/verify" className="bg-orange-500 hover:bg-orange-400 text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all text-sm shrink-0 hover:scale-105">
                Verify Now
              </Link>
            </div>
          )}

          {/* Dynamic Content: Trip Form OR Pending State OR Matched Circle */}
          {matchedTrip && safeCircle ? (
             <div className="backdrop-blur-xl bg-green-500/10 border border-green-500/20 rounded-[2rem] p-6 mb-6 shadow-2xl z-20 relative">
               <div className="flex items-center gap-3 mb-4">
                 <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
                   <Users className="w-6 h-6 text-green-400" />
                 </div>
                 <div>
                   <h3 className="text-xl font-extrabold text-[#eae0c8]">Your SafeCircle is Ready</h3>
                   <p className="text-green-400 text-xs font-bold uppercase tracking-wider">{safeCircle.member_ids?.length || 0} Members • {safeCircle.circle_type}</p>
                 </div>
               </div>
               
               {/* Display Member Details */}
               {safeCircle.memberDetails && safeCircle.memberDetails.length > 0 && (
                 <div className="mb-4">
                   <p className="text-xs text-[#eae0c8]/50 uppercase tracking-widest font-semibold mb-2">Companions</p>
                   <div className="flex flex-col gap-2">
                     {safeCircle.memberDetails.map((m) => (
                       <div key={m.uid} className="flex items-center justify-between bg-[#0B132B]/40 rounded-xl px-3 py-2 border border-white/5">
                         <span className="text-sm font-semibold text-[#eae0c8]">{m.name.split(' ')[0]}</span>
                         <span className="text-xs font-bold text-blue-300 bg-blue-500/10 px-2 py-1 rounded-lg">Rep {m.reputation}</span>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
               
               <div className="bg-[#0B132B]/60 rounded-xl p-4 border border-white/5 mb-4">
                 <p className="text-xs text-[#eae0c8]/50 uppercase tracking-widest font-semibold mb-1">Meeting Point</p>
                 <p className="text-sm font-bold text-[#eae0c8] flex items-center gap-2">
                   <MapPin className="w-4 h-4 text-blue-400" /> {safeCircle.meeting_point?.name || 'Meeting Point'}
                 </p>
               </div>

               <Link to="/circle" className="w-full bg-[#eae0c8] text-[#0B132B] font-extrabold text-sm py-3.5 rounded-xl hover:bg-white hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2 shadow-lg">
                 View Live Map <ArrowRight className="w-4 h-4" />
               </Link>
             </div>
          ) : pendingTrip ? (
             <div className="backdrop-blur-xl bg-blue-500/10 border border-blue-500/20 rounded-[2rem] p-8 mb-6 shadow-2xl z-20 relative flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
                  <div className="w-16 h-16 rounded-full bg-[#0B132B] border-2 border-blue-400/50 flex items-center justify-center relative z-10 shadow-[0_0_20px_rgba(96,165,250,0.4)]">
                    <Search className="w-6 h-6 text-blue-400 animate-pulse" />
                  </div>
                </div>
                <h3 className="text-lg font-extrabold text-[#eae0c8] mb-2 tracking-wide">Finding your SafeCircle...</h3>
                <p className="text-[#eae0c8]/60 text-sm font-medium h-10">
                  {pendingWaitTime > 15 
                    ? "No nearby users found right now. Still searching..." 
                    : "Connecting you with verified companions nearby."}
                </p>
             </div>
          ) : (
            <form onSubmit={handleCreateTrip} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[2rem] p-5 mb-6 shadow-2xl z-20 relative">
              <div className="relative flex flex-col gap-3">
                <div className="absolute left-[23px] top-[1.8rem] bottom-[1.8rem] w-[2px] bg-white/10 rounded-full z-0"></div>
                
                <div className="relative z-10 flex items-center gap-4 bg-[#0B132B]/60 p-2 rounded-2xl w-full border border-white/5 focus-within:border-white/20 transition-all">
                  <div className="w-4 h-4 ml-2 rounded-full bg-blue-400 shrink-0 shadow-[0_0_10px_rgba(96,165,250,0.5)] border-[3px] border-[#0B132B]"></div>
                  <input 
                    type="text" 
                    value={source} 
                    onChange={(e) => setSource(e.target.value)} 
                    placeholder="Current Location" 
                    required
                    className="bg-transparent border-none outline-none text-[#eae0c8] font-medium text-lg w-full placeholder-[#9CA3AF]"
                  />
                </div>

                <div className="relative z-10 flex items-center gap-4 bg-[#0B132B]/60 p-2 rounded-2xl w-full border border-white/5 focus-within:border-white/20 transition-all">
                  <div className="w-4 h-4 ml-2 bg-red-400 shrink-0 shadow-[0_0_10px_rgba(248,113,113,0.5)] border-[3px] border-[#0B132B] transform rotate-45"></div>
                  <input 
                    type="text" 
                    value={destination} 
                    onChange={(e) => setDestination(e.target.value)} 
                    placeholder="Where to?" 
                    required
                    className="bg-transparent border-none outline-none text-[#eae0c8] font-bold text-lg w-full placeholder-[#9CA3AF]"
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setCircleType('Mixed')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${circleType === 'Mixed' ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-white/5 border-white/5 text-[#eae0c8]/50 hover:bg-white/10'}`}>
                  Mixed Group
                </button>
                <button type="button" onClick={() => setCircleType('Women Only')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${circleType === 'Women Only' ? 'bg-pink-500/20 border-pink-500/50 text-pink-300' : 'bg-white/5 border-white/5 text-[#eae0c8]/50 hover:bg-white/10'}`}>
                  Women Only
                </button>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting || !isVerified}
                className="mt-5 w-full bg-[#eae0c8] text-[#0B132B] font-extrabold text-base py-3.5 rounded-xl hover:bg-white hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(234,224,200,0.3)] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
                Find Safe Circle
              </button>
            </form>
          )}

          {/* Live Full Width Map Section */}
          <div className="w-full h-[45vh] lg:h-[55vh] rounded-[2rem] overflow-hidden border border-white/10 relative shadow-2xl bg-[#090E20] mt-auto">
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
