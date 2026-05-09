import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, auth } from '../services/firebase';
import { getCircleMembers } from '../services/matching';
import {
  collection, query, where, onSnapshot, orderBy, getDoc, getDocs, doc,
  addDoc, serverTimestamp, writeBatch, updateDoc, arrayUnion
} from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Polyline, Circle as LeafletCircle, useMap } from 'react-leaflet';
import { AlertCircle, Phone, Share2, AlertTriangle, CheckCircle2, MapPin, Users, Shield, Loader2, Bell, PhoneCall, Flag, Send, Star } from 'lucide-react';
import ngeohash from 'ngeohash';
import toast from 'react-hot-toast';
import Header from '../components/Layout/Header';
import Navigation from '../components/Layout/Navigation';
import PageTransition from '../components/PageTransition';
import ThemedTileLayer from '../components/ThemedTileLayer';
import { motion, useReducedMotion } from 'framer-motion';

// Map Auto-Center Component
function AutoCenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, map.getZoom(), { animate: true });
  }, [position, map]);
  return position ? (
    <>
      <Marker position={position} />
      <LeafletCircle center={position} radius={500} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1 }} />
    </>
  ) : null;
}

function FitMapBounds({ positions }) {
  const map = useMap();
  const boundsKey = positions
    .filter(Boolean)
    .map((position) => position.join(','))
    .join('|');

  useEffect(() => {
    const validPositions = positions.filter(Boolean);
    if (validPositions.length > 1) {
      map.fitBounds(validPositions, { padding: [24, 24] });
    } else if (validPositions.length === 1) {
      map.setView(validPositions[0], map.getZoom(), { animate: true });
    }
  }, [boundsKey, map]);

  return null;
}

function toLatLng(coords) {
  if (!coords) return null;

  if (Array.isArray(coords) && coords.length >= 2) {
    const [lat, lng] = coords;
    return typeof lat === 'number' && typeof lng === 'number' ? [lat, lng] : null;
  }

  const lat = coords.lat ?? coords.latitude;
  const lng = coords.lng ?? coords.longitude;
  return typeof lat === 'number' && typeof lng === 'number' ? [lat, lng] : null;
}

function isSameLatLng(a, b) {
  if (!a || !b) return false;
  return Math.abs(a[0] - b[0]) < 0.00001 && Math.abs(a[1] - b[1]) < 0.00001;
}

export default function CirclePage() {
  const shouldReduceMotion = useReducedMotion();
  const { circleId: paramCircleId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = auth.currentUser?.uid;
  const currentUser = user;

  const [circleId, setCircleId] = useState(paramCircleId);
  const [circle, setCircle] = useState(null);
  const [members, setMembers] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [showFakeCall, setShowFakeCall] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [lastSafetyPing, setLastSafetyPing] = useState(null);
  const [userData, setUserData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [walkingRoute, setWalkingRoute] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const messagesEndRef = useRef(null);
  const sourceCoords = toLatLng(circle?.source_coords || circle?.origin_coords || circle?.meeting_point);
  const destinationCoords = toLatLng(circle?.destination_coords || circle?.dest_coords);
  const meetingPointCoords = toLatLng(circle?.meeting_point);
  const mapCenter = meetingPointCoords || sourceCoords || destinationCoords;
  const routeKey = sourceCoords && destinationCoords
    ? `${sourceCoords[0]},${sourceCoords[1]}:${destinationCoords[0]},${destinationCoords[1]}`
    : '';

  // Find active circle if no circleId provided
  useEffect(() => {
    if (circleId) return; // Already have a circleId

    const findActiveCircle = async () => {
      try {
        const q = query(
          collection(db, 'safe_circles'),
          where('member_ids', 'array-contains', userId),
          where('status', '==', 'matched')
        );

        const unsubscribe = onSnapshot(q, (snap) => {
          if (!snap.empty) {
            const foundCircle = snap.docs[0];
            setCircleId(foundCircle.id);
            navigate(`/circle/${foundCircle.id}`, { replace: true });
          } else {
            // No active circle found
            toast.error('No active SafeCircle');
            navigate('/dashboard', { replace: true });
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error finding active circle:', error);
        navigate('/dashboard', { replace: true });
      }
    };

    findActiveCircle();
  }, [circleId, userId, navigate]);

  // Fetch circle data and members
  useEffect(() => {
    if (!circleId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'safe_circles', circleId),
      async (docSnap) => {
        if (docSnap.exists()) {
          const circleData = docSnap.data();
          setCircle({ id: docSnap.id, ...circleData });

          // Auto-redirect if completed
          if (circleData.status === 'completed') {
            toast.success('Trip completed successfully!');
            setTimeout(() => navigate('/dashboard'), 2000);
          }

          // Fetch members
          const membersList = await getCircleMembers(circleId);
          setMembers(membersList);
        } else {
          toast.error('Circle not found');
          navigate('/dashboard');
        }
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [circleId, navigate]);

  useEffect(() => {
    if (!circleId) return;

    const q = query(
      collection(db, 'safe_circles', circleId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [circleId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const fetchUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUser();
  }, [currentUser]);

  useEffect(() => {
    if (!routeKey || !sourceCoords || !destinationCoords) {
      setWalkingRoute([]);
      setRouteError('');
      return;
    }

    const controller = new AbortController();
    const fetchWalkingRoute = async () => {
      setRouteLoading(true);
      setRouteError('');

      try {
        const [sourceLat, sourceLng] = sourceCoords;
        const [destLat, destLng] = destinationCoords;
        const url = `https://router.project-osrm.org/route/v1/foot/${sourceLng},${sourceLat};${destLng},${destLat}?overview=full&geometries=geojson`;
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`OSRM route failed: ${response.status}`);
        }

        const data = await response.json();
        const coordinates = data?.routes?.[0]?.geometry?.coordinates;

        if (!Array.isArray(coordinates) || coordinates.length === 0) {
          throw new Error('OSRM route response did not include coordinates');
        }

        setWalkingRoute(coordinates.map(([lng, lat]) => [lat, lng]));
      } catch (error) {
        if (error.name === 'AbortError') return;

        console.error('Walking route fetch failed:', error);
        setWalkingRoute([]);
        setRouteError('Walking route unavailable. Showing map markers only.');
      } finally {
        if (!controller.signal.aborted) {
          setRouteLoading(false);
        }
      }
    };

    fetchWalkingRoute();

    return () => controller.abort();
  }, [routeKey]);

  // Get user location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => console.error('Location error:', error),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Live location tracking (every 10 seconds)
  useEffect(() => {
    if (!userLocation || !userId) return;

    setIsTracking(true);

    const updateLocation = async () => {
      try {
        const geohash = ngeohash.encode(userLocation[0], userLocation[1], 6);
        await updateDoc(doc(db, 'live_locations', userId), {
          userId,
          geohash,
          updatedAt: Date.now(),
        });
      } catch (error) {
        // Create if doesn't exist
        await addDoc(collection(db, 'live_locations'), {
          userId,
          geohash: ngeohash.encode(userLocation[0], userLocation[1], 6),
          updatedAt: Date.now(),
        });
      }
    };

    // Update immediately
    updateLocation();

    // Then every 10 seconds
    const interval = setInterval(updateLocation, 10000);

    return () => clearInterval(interval);
  }, [userLocation, userId]);

  // Alert circle
  const handleAlertCircle = async () => {
    try {
      await addDoc(collection(db, 'alerts'), {
        circleId,
        triggeredBy: userId,
        timestamp: serverTimestamp(),
        type: 'circle_alert',
      });
      toast.success('Alert sent to all members');
    } catch (error) {
      toast.error('Failed to send alert');
    }
  };

  // Fake call
  const handleFakeCall = () => {
    setShowFakeCall(true);
    // Play audio
    const audio = new Audio('data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==');
    audio.play().catch(() => {});
    setTimeout(() => setShowFakeCall(false), 5000);
  };

  // Share location
  const handleShareLocation = async () => {
    const url = `${window.location.origin}/live/${circleId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'My SafeCircle Journey',
          text: 'Track my live location',
          url,
        });
      } else {
        // Fallback to WhatsApp
        window.open(`https://wa.me/?text=Tracking my SafeCircle: ${url}`);
      }
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  // Safety ping
  const handleSafetyPing = async (status) => {
    try {
      if (!userLocation) {
        toast.error('Location not available');
        return;
      }

      const geohash = ngeohash.encode(userLocation[0], userLocation[1], 6);
      await addDoc(collection(db, 'safety_pings'), {
        userId,
        circleId,
        geohash,
        status, // 'safe', 'moderate', 'avoid'
        timestamp: serverTimestamp(),
      });

      setLastSafetyPing(status);
      toast.success(`Status: ${status.toUpperCase()}`);
      setTimeout(() => setLastSafetyPing(null), 3000);
    } catch (error) {
      toast.error('Failed to send safety ping');
    }
  };

  const handleSendMessage = async () => {
    const safeMessage = messageText.trim();
    const senderId = currentUser?.uid || userId;
    const senderName = userData?.name || currentUser?.email || 'User';

    if (!safeMessage || !circleId || !senderId || !senderName) return;

    try {
      await addDoc(
        collection(db, 'safe_circles', circleId, 'messages'),
        {
          text: safeMessage,
          senderId,
          senderName,
          createdAt: serverTimestamp(),
        }
      );

      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Complete trip — only the CURRENT user's trip is marked completed.
  // Circle flips to 'completed' only when every member has reached.
  const handleCompleteTrip = async () => {
    if (!currentUser?.uid || !circleId) return;
    setShowCompleteConfirm(false);

    try {
      // 1. Find this user's trip(s) in this circle.
      const myTripsSnap = await getDocs(
        query(
          collection(db, 'trips'),
          where('circle_id', '==', circleId),
          where('userId', '==', currentUser.uid)
        )
      );

      const batch = writeBatch(db);

      // 2. Mark only this user's trip(s) completed.
      myTripsSnap.docs.forEach((d) => {
        batch.update(d.ref, {
          status: 'completed',
          completedAt: serverTimestamp(),
        });
      });

      // 3. Record this user in the circle's reachedBy array.
      batch.update(doc(db, 'safe_circles', circleId), {
        reachedBy: arrayUnion(currentUser.uid),
      });

      // 4. Bump only this user's reputation.
      const myReputation = members.find((m) => m.uid === currentUser.uid)?.reputation ?? 0;
      batch.update(doc(db, 'users', currentUser.uid), {
        reputation_score: myReputation + 1,
      });

      await batch.commit();

      // 5. If this user is the last to reach, flip the whole circle to completed.
      const circleSnap = await getDoc(doc(db, 'safe_circles', circleId));
      const circleData = circleSnap.data();
      const reachedAll =
        Array.isArray(circleData?.reachedBy) &&
        Array.isArray(circleData?.member_ids) &&
        circleData.reachedBy.length >= circleData.member_ids.length;

      if (reachedAll && circleData.status !== 'completed') {
        await updateDoc(doc(db, 'safe_circles', circleId), {
          status: 'completed',
          completedAt: serverTimestamp(),
        });
        await addDoc(collection(db, 'trip_logs'), {
          circleId,
          completedAt: serverTimestamp(),
          members: members.map((m) => ({ uid: m.uid, name: m.name })),
        });
      }

      toast.success('Trip marked as completed');
      navigate('/dashboard');
    } catch (error) {
      console.error('Complete trip error:', error);
      toast.error('Failed to complete trip');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B132B] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!circle) {
    return (
      <div className="min-h-screen bg-[#0B132B] flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center pb-20">
          <p className="text-[#eae0c8]/60">Circle not found</p>
        </main>
        <Navigation />
      </div>
    );
  }

  const routeParts = (circle.route_summary || '')
    .split(/\s*(?:->|→|â†’)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const rawSourceLabel = circle.source || circle.origin || circle.origin_landmark || routeParts[0];
  const sourceLabel = rawSourceLabel || 'Source';
  const destinationLabel =
    circle.destination ||
    circle.destination_landmark ||
    routeParts[1] ||
    'Destination';
  const meetingPointLabel =
    circle.meetingPoint ||
    rawSourceLabel ||
    circle.meeting_point?.name ||
    'Meeting Point';

  return (
    <div className="app-shell">
      <Header />
      <PageTransition>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Your SafeCircle</div>
              <div className="card-subtitle">{members.length} member{members.length !== 1 ? 's' : ''} traveling together</div>
            </div>
            <span className={`chip chip-dot ${circle.status === 'completed' ? 'chip-completed' : 'chip-matched'}`}>
              {circle.status || 'Matched'}
            </span>
          </div>
          <div className="route-info">
            <div className="route-stop">
              <span className="route-dot origin" />
              <span>{sourceLabel}</span>
            </div>
            <div className="route-line" />
            <div className="route-stop">
              <span className="route-dot destination" />
              <span>{destinationLabel}</span>
            </div>
          </div>
        </div>

        <section className="circle-members-section">
          <div className="section-header">
            <h2 className="section-title">Members</h2>
          </div>
          {members.map((member, idx) => (
            <div key={member.uid + idx} className="member-card">
              <div className="member-avatar">{(member.name || 'U')[0].toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="member-name">
                  {member.name || 'SafeCircle member'} {member.uid === userId && <span className="text-[var(--color-600)]">(You)</span>}
                </p>
                <p className="member-rep inline-flex items-center gap-1">
                  <Star size={12} fill="var(--color-500)" color="var(--color-500)" />
                  {member.reputation?.toFixed ? member.reputation.toFixed(1) : member.reputation || 0}
                </p>
              </div>
              {member.verified && <Shield className="text-[var(--safe-green)]" size={18} />}
            </div>
          ))}
        </section>

        <div className="section-header">
          <h2 className="section-title">Meeting Point</h2>
        </div>
        <div className="meeting-point-banner">
          <Flag className="shrink-0 text-[var(--color-700)]" size={20} />
          <div>
            <p className="meeting-point-label">Meet at</p>
            <p className="meeting-point-value">{meetingPointLabel}</p>
            <p className="card-subtitle">
              Departure: {circle.estimated_departure ? new Date(circle.estimated_departure).toLocaleTimeString() : 'TBD'}
            </p>
          </div>
        </div>

        {mapCenter && (
          <>
            <div className="section-header">
              <h2 className="section-title">Route Map</h2>
            </div>
            <div className="map-container mb-5">
              <MapContainer center={mapCenter} zoom={15} className="h-full w-full">
                <ThemedTileLayer />
                {walkingRoute.length > 0 && (
                  <Polyline
                    positions={walkingRoute}
                    pathOptions={{ color: '#0077b6', weight: 5, opacity: 0.85 }}
                  />
                )}
                {sourceCoords && <Marker position={sourceCoords} />}
                {destinationCoords && <Marker position={destinationCoords} />}
                {meetingPointCoords && !isSameLatLng(meetingPointCoords, sourceCoords) && !isSameLatLng(meetingPointCoords, destinationCoords) && (
                  <Marker position={meetingPointCoords} />
                )}
                {userLocation && <AutoCenterMap position={userLocation} />}
                <FitMapBounds positions={walkingRoute.length > 0 ? walkingRoute : [sourceCoords, destinationCoords, meetingPointCoords]} />
              </MapContainer>
              {(routeLoading || routeError) && (
                <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[500] rounded-xl border border-[var(--border-light)] bg-white/90 px-3 py-2 text-xs font-semibold text-[var(--text-caption)]">
                  {routeLoading ? 'Loading walking route...' : routeError}
                </div>
              )}
            </div>
          </>
        )}

        <section className="chat-section">
          <div className="section-header">
            <h2 className="section-title">Circle Chat</h2>
          </div>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <p className="empty-state-desc m-auto">No messages yet</p>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.senderId === currentUser?.uid || msg.sender_id === currentUser?.uid;
                const created = msg.createdAt || msg.created_at;
                return (
                  <motion.div
                    key={msg.id}
                    className={`chat-bubble ${isOwn ? 'own' : 'other'}`}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: 'easeOut' }}
                  >
                    {!isOwn && <p className="sender-name">{msg.senderName || msg.sender_name || 'User'}</p>}
                    <p>{msg.text}</p>
                    {created && (
                      <p className="message-time">
                        {typeof created?.toDate === 'function' ? created.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    )}
                  </motion.div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="chat-input-row">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Message your circle..."
              maxLength={300}
              className="chat-input-field"
            />
            <button type="button" onClick={handleSendMessage} disabled={!messageText.trim()} className="chat-send-btn" aria-label="Send message">
              <Send size={18} />
            </button>
          </div>
        </section>

        <div className="section-header">
          <h2 className="section-title">Emergency Tools</h2>
        </div>
        <div className="emergency-grid">
          <motion.button
            type="button"
            onClick={handleAlertCircle}
            className="emergency-card alert"
            whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
            whileHover={shouldReduceMotion ? undefined : { y: -3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          >
            <span className="emergency-icon-wrap"><Bell size={18} /></span>
            <span className="emergency-card-label">Alert Circle</span>
            <span className="emergency-card-desc">Notify all members now</span>
          </motion.button>
          <motion.button
            type="button"
            onClick={handleFakeCall}
            className="emergency-card fake-call"
            whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
            whileHover={shouldReduceMotion ? undefined : { y: -3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          >
            <span className="emergency-icon-wrap"><Phone size={18} /></span>
            <span className="emergency-card-label">Fake Call</span>
            <span className="emergency-card-desc">Simulate incoming call</span>
          </motion.button>
          <motion.button
            type="button"
            onClick={handleShareLocation}
            className="emergency-card share-location"
            whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
            whileHover={shouldReduceMotion ? undefined : { y: -3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          >
            <span className="emergency-icon-wrap"><Share2 size={18} /></span>
            <span className="emergency-card-label">Share Location</span>
            <span className="emergency-card-desc">Send via WhatsApp</span>
          </motion.button>
          <motion.button
            type="button"
            onClick={() => setShowEmergency(true)}
            className="emergency-card emergency-call"
            whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
            whileHover={shouldReduceMotion ? undefined : { y: -3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          >
            <span className="emergency-icon-wrap"><PhoneCall size={18} /></span>
            <span className="emergency-card-label">Emergency Call</span>
            <span className="emergency-card-desc">Police 100 · Helpline 1090</span>
          </motion.button>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Safety Status</div>
              <div className="card-subtitle">Send a quick status update to your circle</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => handleSafetyPing('safe')} disabled={lastSafetyPing === 'safe'} className="chip chip-completed justify-center !h-11">Safe</button>
            <button onClick={() => handleSafetyPing('moderate')} disabled={lastSafetyPing === 'moderate'} className="chip chip-matched justify-center !h-11">Moderate</button>
            <button onClick={() => handleSafetyPing('avoid')} disabled={lastSafetyPing === 'avoid'} className="chip chip-danger justify-center !h-11">Avoid</button>
          </div>
        </div>

        {(() => {
          const alreadyReached =
            Array.isArray(circle?.reachedBy) &&
            currentUser?.uid &&
            circle.reachedBy.includes(currentUser.uid);
          return (
            <button
              onClick={() => setShowCompleteConfirm(true)}
              disabled={alreadyReached}
              className="btn-reached-safely"
            >
              <CheckCircle2 size={20} />
              {alreadyReached ? 'Already Marked Reached' : 'Reached Safely'}
            </button>
          );
        })()}
      </PageTransition>

      {showFakeCall && (
        <div className="modal-backdrop">
          <div className="modal-card text-center">
            <Phone className="mx-auto mb-4 animate-pulse text-[var(--color-600)]" size={56} />
            <h3 className="profile-name">Incoming Call</h3>
            <p className="profile-email mb-4">Mom</p>
            <p className="card-subtitle">"I'm calling the police, stay safe"</p>
          </div>
        </div>
      )}

      {showEmergency && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3 className="card-title mb-4 flex items-center gap-2">
              <AlertTriangle className="text-[var(--emergency-red)]" size={22} />
              Emergency Contacts
            </h3>
            <div className="grid gap-3">
              <a href="tel:100" className="btn-danger w-full">Call Police (100)</a>
              <a href="tel:1090" className="btn-danger w-full">Women Helpline (1090)</a>
              <button onClick={() => setShowEmergency(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {showCompleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3 className="card-title mb-2 flex items-center gap-2">
              <CheckCircle2 className="text-[var(--safe-green)]" size={22} />
              Mark Reached Safely?
            </h3>
            <p className="card-subtitle mb-5">
              This confirms you've reached your destination. Other members can still complete their own trips independently.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowCompleteConfirm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCompleteTrip} className="btn-primary">Confirm</button>
            </div>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  );

  if (false) return (
    <div className="min-h-screen bg-[#0B132B] flex flex-col text-[#eae0c8] pb-20">
      <Header />

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
        {/* Header Card */}
        <div className="bg-[#111A3A]/70 backdrop-blur-md border border-white/5 rounded-2xl p-6 mb-6">
          <h1 className="text-3xl font-bold mb-1">Your SafeCircle</h1>
          <p className="text-[#eae0c8]/60 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Source: <span className="text-[#eae0c8]">{sourceLabel}</span>
          </p>
          <p className="text-[#eae0c8]/60 mt-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Destination: <span className="text-[#eae0c8]">{destinationLabel}</span>
          </p>
          <p className="text-[#eae0c8]/60 mt-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Meeting Point: <span className="text-[#eae0c8]">{meetingPointLabel}</span>
          </p>
          <p className="text-[#eae0c8]/60 mt-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Meeting Point Card */}
        <div className="bg-[#111A3A]/70 backdrop-blur-md border border-white/5 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            Meeting Point
          </h2>
          <p className="text-[#eae0c8] font-medium">{meetingPointLabel}</p>
          <p className="text-[#eae0c8]/60 text-sm mt-2">
            Departure: {circle.estimated_departure ? new Date(circle.estimated_departure).toLocaleTimeString() : 'TBD'}
          </p>
        </div>

        {/* Live Map */}
        {mapCenter && (
          <div className="relative bg-[#111A3A]/70 backdrop-blur-md border border-white/5 rounded-2xl p-4 mb-6 h-64 overflow-hidden">
            <MapContainer center={mapCenter} zoom={15} className="h-full w-full rounded-lg">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {walkingRoute.length > 0 && (
                <Polyline
                  positions={walkingRoute}
                  pathOptions={{ color: '#3b82f6', weight: 5, opacity: 0.9 }}
                />
              )}
              {sourceCoords && <Marker position={sourceCoords} />}
              {destinationCoords && <Marker position={destinationCoords} />}
              {meetingPointCoords && !isSameLatLng(meetingPointCoords, sourceCoords) && !isSameLatLng(meetingPointCoords, destinationCoords) && (
                <Marker position={meetingPointCoords} />
              )}
              {userLocation && <AutoCenterMap position={userLocation} />}
              <FitMapBounds positions={walkingRoute.length > 0 ? walkingRoute : [sourceCoords, destinationCoords, meetingPointCoords]} />
            </MapContainer>
            {(routeLoading || routeError) && (
              <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[500] rounded-xl border border-white/5 bg-[#0B132B]/80 px-3 py-2 text-xs text-[#eae0c8]/70 backdrop-blur-md">
                {routeLoading ? 'Loading walking route...' : routeError}
              </div>
            )}
          </div>
        )}

        {/* Members List */}
        <div className="bg-[#111A3A]/70 backdrop-blur-md border border-white/5 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Members
          </h2>
          <div className="space-y-3">
            {members.map((member, idx) => (
              <div key={member.uid + idx} className="flex items-center justify-between p-3 bg-[#0B132B]/60 hover:bg-[#111A3A] rounded-lg transition">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <div>
                    <p className="text-[#eae0c8] font-medium">
                      {member.name}
                      {member.uid === userId && <span className="text-xs ml-2 text-blue-400">(You)</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.verified && <Shield className="w-4 h-4 text-green-400" />}
                  {member.reputation > 0 && <span className="text-xs text-[#eae0c8]/60">⭐ {member.reputation.toFixed(1)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={handleAlertCircle}
            className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-xl p-4 transition flex flex-col items-center gap-2"
          >
            <AlertCircle className="w-6 h-6 text-red-400" />
            <span className="text-xs font-semibold text-red-300">Alert Circle</span>
          </button>

          <button
            onClick={handleFakeCall}
            className="bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-xl p-4 transition flex flex-col items-center gap-2"
          >
            <Phone className="w-6 h-6 text-blue-400" />
            <span className="text-xs font-semibold text-blue-300">Fake Call</span>
          </button>

          <button
            onClick={handleShareLocation}
            className="bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-xl p-4 transition flex flex-col items-center gap-2"
          >
            <Share2 className="w-6 h-6 text-blue-400" />
            <span className="text-xs font-semibold text-blue-300">Share Location</span>
          </button>

          <button
            onClick={() => setShowEmergency(true)}
            className="bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded-xl p-4 transition flex flex-col items-center gap-2"
          >
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <span className="text-xs font-semibold text-red-400">Emergency</span>
          </button>
        </div>

        {/* Safety Ping Buttons */}
        <div className="bg-[#111A3A]/70 backdrop-blur-md border border-white/5 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-semibold mb-3 text-[#eae0c8]/60 uppercase tracking-wide">Safety Status</h2>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleSafetyPing('safe')}
              disabled={lastSafetyPing === 'safe'}
              className={`py-3 px-2 rounded-lg font-medium text-xs transition ${
                lastSafetyPing === 'safe'
                  ? 'bg-green-500/40 text-green-200'
                  : 'bg-green-500/20 hover:bg-green-500/30 text-green-300'
              }`}
            >
              Safe
            </button>
            <button
              onClick={() => handleSafetyPing('moderate')}
              disabled={lastSafetyPing === 'moderate'}
              className={`py-3 px-2 rounded-lg font-medium text-xs transition ${
                lastSafetyPing === 'moderate'
                  ? 'bg-blue-500/40 text-[#EAE0C8]'
                  : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300'
              }`}
            >
              Moderate
            </button>
            <button
              onClick={() => handleSafetyPing('avoid')}
              disabled={lastSafetyPing === 'avoid'}
              className={`py-3 px-2 rounded-lg font-medium text-xs transition ${
                lastSafetyPing === 'avoid'
                  ? 'bg-red-500/40 text-red-200'
                  : 'bg-red-500/20 hover:bg-red-500/30 text-red-300'
              }`}
            >
              Avoid
            </button>
          </div>
        </div>

        {/* Chat Composer */}
        <div className="bg-[#111A3A]/70 backdrop-blur-md border border-white/5 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Circle Chat
          </h2>
          <div className="mb-4 h-[300px] overflow-y-auto space-y-3 pr-1">
            {messages.length === 0 ? (
              <p className="text-sm text-[#eae0c8]/60">No messages yet</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="rounded-xl border border-white/5 bg-[#0B132B]/60 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">
                    {msg.senderName || 'User'}
                  </p>
                  <p className="mt-1 text-sm text-[#eae0c8]">{msg.text}</p>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Send a message to your circle..."
              maxLength={300}
              className="flex-1 rounded-xl border border-white/5 bg-[#0B132B]/60 px-4 py-3 text-[#eae0c8] placeholder:text-[#eae0c8]/40 outline-none focus:border-blue-400/40"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!messageText.trim()}
              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-[#EAE0C8] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>

        {/* Complete Trip Button */}
        {(() => {
          const alreadyReached =
            Array.isArray(circle?.reachedBy) &&
            currentUser?.uid &&
            circle.reachedBy.includes(currentUser.uid);
          return (
            <button
              onClick={() => setShowCompleteConfirm(true)}
              disabled={alreadyReached}
              className="w-full bg-blue-500/30 hover:bg-blue-500/40 border border-blue-500/50 rounded-xl py-4 font-semibold text-[#eae0c8] transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-500/30"
            >
              <CheckCircle2 className="w-5 h-5" />
              {alreadyReached ? 'Already Marked Reached' : 'Mark as Reached Safely'}
            </button>
          );
        })()}
      </main>

      {/* Fake Call Modal */}
      {showFakeCall && (
        <div className="fixed inset-0 bg-[#0B132B]/70 flex items-center justify-center z-50">
          <div className="bg-[#111A3A]/70 backdrop-blur-md border border-white/5 rounded-2xl p-8 text-center max-w-sm">
            <Phone className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-pulse" />
            <h3 className="text-2xl font-bold text-[#eae0c8] mb-2">Incoming Call</h3>
            <p className="text-[#eae0c8]/60 mb-6">Mom</p>
            <p className="text-sm text-blue-300">
              "I'm calling the police, stay safe"
            </p>
          </div>
        </div>
      )}

      {/* Emergency Modal */}
      {showEmergency && (
        <div className="fixed inset-0 bg-[#0B132B]/70 flex items-center justify-center z-50">
          <div className="bg-[#111A3A]/70 backdrop-blur-md border border-white/5 rounded-2xl p-6 max-w-sm">
            <h3 className="text-xl font-bold text-[#eae0c8] mb-4 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              Emergency Contacts
            </h3>
            <div className="space-y-3">
              <a
                href="tel:100"
                className="block bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-xl py-3 text-center text-red-300 font-medium transition"
              >
                Call Police (100)
              </a>
              <a
                href="tel:1090"
                className="block bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-xl py-3 text-center text-red-300 font-medium transition"
              >
                Women Helpline (1090)
              </a>
              <button
                onClick={() => setShowEmergency(false)}
                className="w-full bg-[#0B132B]/60 hover:bg-[#0B132B] border border-white/5 rounded-xl py-3 text-[#eae0c8] font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Reached Safely Confirmation Modal */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 bg-[#0B132B]/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111A3A]/90 backdrop-blur-md border border-white/5 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-[#eae0c8] mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-blue-400" />
              Mark Reached Safely?
            </h3>
            <p className="text-[#eae0c8]/70 text-sm mb-6">
              This confirms you've reached your destination. Other circle members
              can still complete their own trips independently.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCompleteConfirm(false)}
                className="flex-1 bg-[#0B132B]/60 hover:bg-[#0B132B] border border-white/5 rounded-xl py-3 text-[#eae0c8] font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteTrip}
                className="flex-1 bg-blue-500/30 hover:bg-blue-500/40 border border-blue-500/50 rounded-xl py-3 text-[#eae0c8] font-semibold transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  );
}
