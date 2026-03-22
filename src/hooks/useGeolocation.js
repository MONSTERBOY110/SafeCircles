import { useState, useEffect, useCallback } from 'react';
import { getCurrentPosition, watchPosition, clearWatch } from '../services/geolocation';

/**
 * Hook to access and watch user's geolocation.
 */
export function useGeolocation(autoWatch = false) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [watchId, setWatchId] = useState(null);

  const fetchOnce = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pos = await getCurrentPosition();
      setPosition(pos);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const startWatching = useCallback(() => {
    const id = watchPosition(
      (pos) => setPosition(pos),
      (err) => setError(err.message)
    );
    setWatchId(id);
    return id;
  }, []);

  const stopWatching = useCallback(() => {
    if (watchId !== null) {
      clearWatch(watchId);
      setWatchId(null);
    }
  }, [watchId]);

  useEffect(() => {
    if (autoWatch) {
      startWatching();
      return () => stopWatching();
    }
  }, [autoWatch]);

  return { position, error, loading, fetchOnce, startWatching, stopWatching };
}
