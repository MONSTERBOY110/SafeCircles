import React, { useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { getCurrentPosition } from '../../services/geolocation';
import { buildTripStartSmsHref } from '../../utils/sos';

const STORAGE_PREFIX = 'safecircles:trip_sms_sent:';

const isAlreadySent = (tripId) => {
  try {
    return !!localStorage.getItem(STORAGE_PREFIX + tripId);
  } catch {
    return false;
  }
};
const markSent = (tripId) => {
  try {
    localStorage.setItem(STORAGE_PREFIX + tripId, String(Date.now()));
  } catch {
    /* private mode / storage disabled — best effort */
  }
};

const btnPrimary = {
  borderRadius: 6,
  background: '#2563eb',
  color: '#EAE0C8',
  padding: '6px 14px',
  fontSize: 13,
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
};
const btnSecondary = {
  borderRadius: 6,
  background: 'transparent',
  color: '#EAE0C8',
  padding: '6px 12px',
  fontSize: 13,
  fontWeight: 600,
  border: '1px solid rgba(234,224,200,0.3)',
  cursor: 'pointer',
};

function showNotifyPrompt(trip, contacts, userName) {
  const id = `trip-notify-${trip.id}`;
  const count = contacts.length;

  toast(
    (t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 240 }}>
        <div style={{ fontWeight: 700 }}>
          Trip matched — notify your {count} emergency contact{count > 1 ? 's' : ''}?
        </div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          We'll prefill an SMS with your route and live location. You tap Send.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            style={btnSecondary}
            onClick={() => {
              markSent(trip.id);
              toast.dismiss(t.id);
            }}
          >
            Skip
          </button>
          <button
            type="button"
            style={btnPrimary}
            onClick={async () => {
              let pos = null;
              try {
                pos = await getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 });
              } catch {
                /* ignore — SMS still gets opened without coords */
              }
              const href = buildTripStartSmsHref(contacts, trip, pos, userName);
              markSent(trip.id);
              toast.dismiss(t.id);
              // Same-gesture navigation; opens the messaging app prefilled.
              window.location.href = href;
            }}
          >
            Notify
          </button>
        </div>
      </div>
    ),
    { id, duration: Infinity }
  );
}

function showAddContactsHint(trip) {
  const id = `trip-notify-${trip.id}`;
  toast(
    (t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 240 }}>
        <div style={{ fontWeight: 700 }}>Trip matched</div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>
          Add emergency contacts on Profile to auto-notify them next time.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            style={btnPrimary}
            onClick={() => {
              markSent(trip.id);
              toast.dismiss(t.id);
            }}
          >
            Got it
          </button>
        </div>
      </div>
    ),
    { id, duration: Infinity }
  );
}

/**
 * Listens to the current user's trips. Whenever a trip is observed in
 * `matched` status that we haven't notified for (per localStorage), shows a
 * persistent toast with a Notify button. The Notify tap is a real user gesture
 * so the `sms:` navigation succeeds — works for both the active-creator case
 * (the user who triggered findAndMatchTrips) and the passive case (a user
 * whose pending trip got matched by someone else creating later).
 *
 * Mount once at the top of App.jsx inside <AuthProvider>.
 */
export default function TripStartNotifier() {
  const { user, userData } = useAuth();
  const promptedRef = useRef(new Set()); // session-local re-fire guard
  const userDataRef = useRef(userData);

  // Keep userData fresh inside the snapshot callback without rebuilding the
  // listener every time the profile updates (the listener depends only on uid).
  useEffect(() => {
    userDataRef.current = userData;
  }, [userData]);

  useEffect(() => {
    if (!user) {
      promptedRef.current.clear();
      return undefined;
    }
    const q = query(collection(db, 'trips'), where('userId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        snap.docs.forEach((d) => {
          const trip = { id: d.id, ...d.data() };
          if (trip.status !== 'matched') return;
          if (promptedRef.current.has(trip.id)) return;
          if (isAlreadySent(trip.id)) {
            promptedRef.current.add(trip.id);
            return;
          }

          // userData may still be loading on first auth — defer rather than
          // showing the "no contacts" hint incorrectly. The snapshot will
          // re-emit when the listener re-attaches after userData lands.
          const ud = userDataRef.current;
          if (ud == null) return;

          promptedRef.current.add(trip.id);
          const contacts = Array.isArray(ud.emergency_contacts)
            ? ud.emergency_contacts
            : [];
          if (contacts.length === 0) {
            showAddContactsHint(trip);
          } else {
            showNotifyPrompt(trip, contacts, ud.name);
          }
        });
      },
      (err) => {
        // eslint-disable-next-line no-console
        console.warn('[trip-start-notifier] trips listener failed:', err.message);
      }
    );
    return unsub;
  }, [user?.uid]);

  return null;
}
