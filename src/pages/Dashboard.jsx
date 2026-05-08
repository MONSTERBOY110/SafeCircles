import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { findAndMatchTrips } from '../services/matching';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Layout/Header';
import Navigation from '../components/Layout/Navigation';
import { MapContainer, TileLayer, useMap, Circle, CircleMarker } from 'react-leaflet';
import ngeohash from 'ngeohash';
import toast from 'react-hot-toast';
import { Users, ShieldCheck, Loader2, Crosshair, X, Clock, MapPin } from 'lucide-react';

function LocationMarker({ position, accuracy }) {
  const map = useMap();

  useEffect(() => {
    if (position) map.setView(position, map.getZoom(), { animate: true });
  }, [position, map]);

  if (!position) return null;
  // Render the browser's actual accuracy radius (clamped so it stays visible
  // but doesn't crash the map for absurd values). Falls back to 120m.
  const ringRadius = Math.min(Math.max(accuracy ?? 120, 30), 50000);
  return (
    <>
      <Circle
        center={position}
        radius={ringRadius}
        pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.12, weight: 1 }}
      />
      <CircleMarker
        center={position}
        radius={8}
        pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#3b82f6', fillOpacity: 1 }}
      />
    </>
  );
}

function RecenterButton({ position }) {
  const map = useMap();
  if (!position) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        map.setView(position, Math.max(map.getZoom(), 16), { animate: true });
      }}
      className="absolute top-3 right-3 z-[400] w-10 h-10 rounded-full bg-[#0B132B]/90 backdrop-blur-md border border-white/10 flex items-center justify-center text-blue-300 hover:bg-[#0B132B] shadow-lg"
      aria-label="Recenter map"
    >
      <Crosshair className="w-5 h-5" />
    </button>
  );
}

export default function Dashboard() {
  const { user, userData, loading: authLoading, isVerified } = useAuth();
  const navigate = useNavigate();

  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [sourceSuggestions, setSourceSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const [recentLocations, setRecentLocations] = useState([]);
  const [reverseGeoLabel, setReverseGeoLabel] = useState(null);
  const [reverseGeoLoading, setReverseGeoLoading] = useState(false);

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
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation not supported by this browser.');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
        setLocationAccuracy(position.coords.accuracy);
        setLocationError(null);
      },
      (error) => {
        console.error('Geolocation error:', error);
        // Map browser error codes to user-readable messages.
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Location permission denied. Enable it in your browser settings to use GPS.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError('Location unavailable. Check your device location services.');
        } else if (error.code === error.TIMEOUT) {
          setLocationError('Location request timed out. Try again or pick manually.');
        } else {
          setLocationError('Could not get location.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const RECENT_KEY = 'safecircles:recent_locations';

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecentLocations(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const pushRecent = (pick) => {
    if (!pick?.label) return;
    setRecentLocations((prev) => {
      const dedup = [pick, ...prev.filter((p) => p.label !== pick.label)].slice(0, 5);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(dedup)); } catch { /* ignore */ }
      return dedup;
    });
  };

  const fetchReverseGeoLabel = async () => {
    if (!userLocation) return null;
    setReverseGeoLoading(true);
    try {
      const [lat, lng] = userLocation;
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`;
      const res = await fetch(url);
      const data = await res.json();
      const label = data?.display_name || `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      setReverseGeoLabel(label);
      return label;
    } catch {
      return null;
    } finally {
      setReverseGeoLoading(false);
    }
  };

  useEffect(() => {
    if (userLocation && !reverseGeoLabel) fetchReverseGeoLabel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation]);

  const useCurrentLocation = async () => {
    if (!userLocation) {
      toast.error('Locating you... please wait a moment.');
      return;
    }
    const [lat, lng] = userLocation;
    const label = reverseGeoLabel || (await fetchReverseGeoLabel()) || `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    const pick = { label, lat, lng };
    if (activeField === 'source') {
      setSelectedSource(pick);
      setSource(label);
      setSourceSuggestions([]);
    } else if (activeField === 'destination') {
      setSelectedDestination(pick);
      setDestination(label);
      setDestinationSuggestions([]);
    }
    pushRecent(pick);
    setActiveField(null);
  };

  // Debounced Nominatim autocomplete — source.
  useEffect(() => {
    if (selectedSource && source === selectedSource.label) {
      setSourceSuggestions([]);
      return;
    }
    if (source.trim().length < 3) {
      setSourceSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(source)}`;
        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json();
        setSourceSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Nominatim source fetch failed:', err);
        }
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [source, selectedSource]);

  // Debounced Nominatim autocomplete — destination.
  useEffect(() => {
    if (selectedDestination && destination === selectedDestination.label) {
      setDestinationSuggestions([]);
      return;
    }
    if (destination.trim().length < 3) {
      setDestinationSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(destination)}`;
        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json();
        setDestinationSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Nominatim destination fetch failed:', err);
        }
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [destination, selectedDestination]);

  const handleSourceChange = (value) => {
    setSource(value);
    if (selectedSource && value !== selectedSource.label) {
      setSelectedSource(null);
    }
  };

  const handleDestinationChange = (value) => {
    setDestination(value);
    if (selectedDestination && value !== selectedDestination.label) {
      setSelectedDestination(null);
    }
  };

  const handleSelectSource = (s) => {
    const pick = { label: s.display_name, lat: Number(s.lat), lng: Number(s.lon) };
    setSelectedSource(pick);
    setSource(pick.label);
    setSourceSuggestions([]);
    pushRecent(pick);
    setActiveField(null);
  };

  const handleSelectDestination = (s) => {
    const pick = { label: s.display_name, lat: Number(s.lat), lng: Number(s.lon) };
    setSelectedDestination(pick);
    setDestination(pick.label);
    setDestinationSuggestions([]);
    pushRecent(pick);
    setActiveField(null);
  };

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

    if (!selectedSource || !selectedDestination) {
      toast.error('Please select a location from suggestions');
      return;
    }

    setIsSubmitting(true);

    try {
      const originLat = selectedSource.lat;
      const originLng = selectedSource.lng;
      const destinationLat = selectedDestination.lat;
      const destinationLng = selectedDestination.lng;
      const safeSource = selectedSource.label;
      const safeDestination = selectedDestination.label;
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
      setSelectedSource(null);
      setSelectedDestination(null);
      setSourceSuggestions([]);
      setDestinationSuggestions([]);

      if (matchResult?.success) {
        toast.success(`SafeCircle formed! ${matchResult.memberCount} members`);
        console.log('Matching successful:', matchResult);
      } else {
        toast.success('Searching for verified companions...');
        console.log('No matches yet, trip in pending state');
      }

      navigate('/trips');
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

              <div className="relative z-30">
                <div className={`relative z-10 flex items-center gap-4 bg-[#0B132B]/60 p-2 rounded-2xl w-full border transition-all ${activeField === 'source' ? 'border-blue-400/50' : 'border-white/5 focus-within:border-[#EAE0C8]/20'}`}>
                  <div className="w-4 h-4 ml-2 rounded-full bg-blue-400 shrink-0 shadow-[0_0_10px_rgba(96,165,250,0.5)] border-[3px] border-[#0B132B]"></div>
                  <input
                    type="text"
                    value={source}
                    onChange={(e) => handleSourceChange(e.target.value)}
                    onFocus={() => setActiveField('source')}
                    placeholder="Pickup location"
                    required
                    autoComplete="off"
                    className="bg-transparent border-none outline-none text-[#eae0c8] font-medium text-lg w-full placeholder:text-[#EAE0C8]/40"
                  />
                </div>
              </div>

              <div className="relative z-20">
                <div className={`relative z-10 flex items-center gap-4 bg-[#0B132B]/60 p-2 rounded-2xl w-full border transition-all ${activeField === 'destination' ? 'border-blue-400/50' : 'border-white/5 focus-within:border-[#EAE0C8]/20'}`}>
                  <div className="w-4 h-4 ml-2 bg-blue-300 shrink-0 shadow-[0_0_10px_rgba(147,197,253,0.45)] border-[3px] border-[#0B132B] transform rotate-45"></div>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => handleDestinationChange(e.target.value)}
                    onFocus={() => setActiveField('destination')}
                    placeholder="Where to?"
                    required
                    autoComplete="off"
                    className="bg-transparent border-none outline-none text-[#eae0c8] font-bold text-lg w-full placeholder:text-[#EAE0C8]/40"
                  />
                </div>
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

          {activeField ? (
            <div className="w-full h-[45vh] lg:h-[55vh] rounded-[2rem] overflow-hidden border border-white/5 relative shadow-2xl bg-[#111A3A]/90 backdrop-blur-xl mt-auto flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h3 className="text-sm font-bold text-[#EAE0C8]/70 uppercase tracking-[0.2em]">
                  {activeField === 'source' ? 'Set Pickup Location' : 'Set Destination'}
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveField(null)}
                  className="text-[#EAE0C8]/60 hover:text-[#EAE0C8] p-1"
                  aria-label="Close suggestions"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={!userLocation}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-blue-500/10 border-b border-white/5 text-left disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center shrink-0">
                    <Crosshair className="w-4 h-4 text-blue-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[#EAE0C8] font-semibold text-sm">Use Current Location</p>
                    <p className="text-[#EAE0C8]/50 text-xs truncate">
                      {reverseGeoLoading ? 'Locating...' : reverseGeoLabel || 'Tap to use GPS'}
                    </p>
                  </div>
                </button>

                {((activeField === 'source' ? source : destination).trim().length < 3) && recentLocations.length > 0 && (
                  <>
                    <p className="px-5 pt-4 pb-2 text-xs font-bold text-[#EAE0C8]/40 uppercase tracking-wider">Recent</p>
                    {recentLocations.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => (activeField === 'source'
                          ? handleSelectSource({ display_name: p.label, lat: p.lat, lon: p.lng, place_id: `recent-${p.label}` })
                          : handleSelectDestination({ display_name: p.label, lat: p.lat, lon: p.lng, place_id: `recent-${p.label}` }))}
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-blue-500/10 border-b border-white/5 last:border-b-0 text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-[#0B132B]/60 border border-white/10 flex items-center justify-center shrink-0">
                          <Clock className="w-4 h-4 text-[#EAE0C8]/60" />
                        </div>
                        <p className="text-[#EAE0C8]/90 text-sm truncate flex-1">{p.label}</p>
                      </button>
                    ))}
                  </>
                )}

                {((activeField === 'source' ? sourceSuggestions : destinationSuggestions).length > 0) && (
                  <>
                    <p className="px-5 pt-4 pb-2 text-xs font-bold text-[#EAE0C8]/40 uppercase tracking-wider">Suggestions</p>
                    {(activeField === 'source' ? sourceSuggestions : destinationSuggestions).map((s) => (
                      <button
                        key={s.place_id}
                        type="button"
                        onClick={() => (activeField === 'source' ? handleSelectSource(s) : handleSelectDestination(s))}
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-blue-500/10 border-b border-white/5 last:border-b-0 text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-[#0B132B]/60 border border-white/10 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4 text-blue-300" />
                        </div>
                        <p className="text-[#EAE0C8] text-sm flex-1">{s.display_name}</p>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full h-[45vh] lg:h-[55vh] rounded-[2rem] overflow-hidden border border-white/5 relative shadow-2xl bg-[#111A3A] mt-auto">
              {userLocation ? (
                <>
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
                    <LocationMarker position={userLocation} accuracy={locationAccuracy} />
                    <RecenterButton position={userLocation} />
                  </MapContainer>
                  {locationAccuracy !== null && locationAccuracy > 1000 && (
                    <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[400] rounded-xl border border-white/5 bg-[#0B132B]/85 backdrop-blur-md px-3 py-2 text-xs text-[#eae0c8]/80 shadow-lg">
                      Approximate location (~{locationAccuracy >= 1000 ? `${(locationAccuracy / 1000).toFixed(1)}km` : `${Math.round(locationAccuracy)}m`}). Desktop browsers don't have GPS — open on your phone for an accurate fix.
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/30 via-[#090E20] to-[#090E20]"></div>
                  <div className="z-10 flex flex-col items-center opacity-70 px-6 text-center">
                    {locationError ? (
                      <p className="text-[#eae0c8] text-sm font-medium">{locationError}</p>
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-blue-400 animate-spin mb-4"></div>
                        <p className="text-[#eae0c8] font-medium tracking-[0.2em] uppercase text-xs">Getting location...</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
        <Navigation />
      </div>
    </div>
  );
}
