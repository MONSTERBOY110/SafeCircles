import { useState, useEffect } from 'react';
import { onSnapshot } from 'firebase/firestore';

/**
 * Generic hook for Firestore real-time listeners.
 * Accepts a Firestore ref or query and returns live data.
 */
export function useRealTimeListener(firestoreRef) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!firestoreRef) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      firestoreRef,
      (snapshot) => {
        // Handle both doc and query snapshots
        if (snapshot.docs) {
          // Query snapshot
          setData(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
          // Document snapshot
          if (snapshot.exists()) {
            setData({ id: snapshot.id, ...snapshot.data() });
          } else {
            setData(null);
          }
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestoreRef]);

  return { data, loading, error };
}
