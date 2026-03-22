import React, { useState } from 'react';
import { getCurrentPosition } from '../../services/geolocation';
import toast from 'react-hot-toast';

export default function ShareLocation() {
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    setLoading(true);
    try {
      const pos = await getCurrentPosition();
      const mapsUrl = `https://www.google.com/maps?q=${pos.lat},${pos.lng}`;
      const message = `🆘 SafeCircles Emergency — I need help! My location: ${mapsUrl}`;

      if (navigator.share) {
        await navigator.share({ title: 'My Location', text: message, url: mapsUrl });
      } else {
        await navigator.clipboard.writeText(message);
        toast.success('Location link copied! Paste and send to trusted contacts.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('Could not get your location.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={loading}
      className="flex flex-col items-center justify-center p-4 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-60"
    >
      <span className="text-2xl mb-1">📍</span>
      {loading ? 'Getting location...' : 'Share Location'}
    </button>
  );
}
