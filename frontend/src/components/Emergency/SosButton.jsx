import React, { useEffect, useRef, useState } from 'react';
import { Siren } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { buildSosSmsHref } from '../../utils/sos';

const HOLD_MS = 1500;
const COOLDOWN_MS = 20000;

export default function SosButton({ activeCircleId }) {
  const { user, userData } = useAuth();
  const [phase, setPhase] = useState('idle'); // idle | arming | firing | cooldown
  const timerRef = useRef(null);
  const cooldownRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  const fire = async () => {
    setPhase('firing');

    // Capture the SMS href synchronously-derivable bits before any awaits.
    // We can't await before opening the SMS app or the gesture is "lost" and
    // some Android browsers will reject the navigation.
    const contacts = userData?.emergency_contacts || [];

    let pos = null;
    try {
      pos = await new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 5000 }
        );
      });
    } catch {
      /* swallow — proceed without coords */
    }

    // Fire-and-forget Firestore writes; don't block SMS opening on network.
    (async () => {
      try {
        await addDoc(collection(db, 'alerts'), {
          type: 'sos',
          triggeredBy: user.uid,
          triggeredByName: userData?.name || null,
          circleId: activeCircleId || null,
          location: pos,
          timestamp: serverTimestamp(),
        });
      } catch (e) {
        console.warn('[sos] alert write failed:', e.message);
      }
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          sos_active: true,
          sos_started_at: serverTimestamp(),
        });
      } catch (e) {
        console.warn('[sos] user flag write failed:', e.message);
      }
    })();

    if (contacts.length === 0) {
      toast.error('No emergency contacts saved. Add some on your Profile.');
    } else {
      const href = buildSosSmsHref(contacts, pos?.lat, pos?.lng, userData?.name);
      // Direct navigation in the same gesture frame.
      window.location.href = href;
      toast.success('SOS sent — opening SMS to your contacts');
    }

    setPhase('cooldown');
    cooldownRef.current = setTimeout(() => setPhase('idle'), COOLDOWN_MS);
  };

  const beginHold = (e) => {
    if (phase !== 'idle') return;
    e.preventDefault();
    setPhase('arming');
    timerRef.current = setTimeout(fire, HOLD_MS);
  };

  const cancelHold = () => {
    if (phase !== 'arming') return;
    clearTimeout(timerRef.current);
    setPhase('idle');
  };

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      clearTimeout(cooldownRef.current);
    },
    []
  );

  const disabled = phase === 'cooldown' || phase === 'firing';

  return (
    <motion.button
      type="button"
      onPointerDown={beginHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      disabled={disabled}
      aria-label="SOS — hold for 1.5 seconds to send an emergency alert"
      whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
      className="sos-fab"
      data-phase={phase}
    >
      <Siren size={22} aria-hidden="true" />
      <span className="sos-fab-label">SOS</span>
      {phase === 'arming' && <span className="sos-fab-ring" aria-hidden="true" />}
    </motion.button>
  );
}
