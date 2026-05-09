import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import SosButton from './SosButton';

const ARMED_STATUSES = ['pending', 'matched', 'active'];

/**
 * Listens to the current user's trips and renders a floating SOS button
 * whenever any trip is in an armed status (pending/matched/active). When all
 * trips are completed/cancelled, the button disappears. Mount this once,
 * top-level, inside <AuthProvider> — it has no per-page coupling.
 */
export default function SosArmer() {
  const { user } = useAuth();
  const [activeCircleId, setActiveCircleId] = useState(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!user) {
      setArmed(false);
      setActiveCircleId(null);
      return undefined;
    }
    const q = query(collection(db, 'trips'), where('userId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const live = snap.docs
          .map((d) => d.data())
          .filter((t) => ARMED_STATUSES.includes(t.status));
        setArmed(live.length > 0);
        const withCircle = live.find((t) => t.circle_id);
        setActiveCircleId(withCircle?.circle_id || null);
      },
      (err) => {
        console.warn('[sos-armer] trips listener failed:', err.message);
        setArmed(false);
      }
    );
    return unsub;
  }, [user?.uid]);

  if (!armed) return null;
  return <SosButton activeCircleId={activeCircleId} />;
}
