import React, { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import toast from 'react-hot-toast';
import FakeCall from './FakeCall';
import ShareLocation from './ShareLocation';

export default function EmergencyButtons({ circleId }) {
  const [fakeCallActive, setFakeCallActive] = useState(false);
  const [alertSent, setAlertSent] = useState(false);

  const handleAlertCircle = async () => {
    const user = auth.currentUser;
    if (!user || !circleId) return;

    try {
      await addDoc(collection(db, 'safe_circles', circleId, 'messages'), {
        text: '🚨 EMERGENCY ALERT — I need help! Please stay with me!',
        sender_id: user.uid,
        sender_name: user.displayName || 'User',
        is_emergency: true,
        created_at: serverTimestamp(),
      });
      setAlertSent(true);
      toast.success('Emergency alert sent to your circle!');
      setTimeout(() => setAlertSent(false), 10000);
    } catch (err) {
      toast.error('Failed to send alert. Try again.');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-5">🚨 Emergency Features</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Alert Circle */}
        <button
          onClick={handleAlertCircle}
          disabled={alertSent}
          className={`flex flex-col items-center justify-center p-4 rounded-xl font-semibold text-sm transition ${
            alertSent
              ? 'bg-red-100 text-red-500 border-2 border-red-400'
              : 'bg-red-600 text-white hover:bg-red-700 emergency-pulse'
          }`}
        >
          <span className="text-2xl mb-1">🚨</span>
          {alertSent ? 'Alert Sent!' : 'Alert Circle'}
        </button>

        {/* Fake Call */}
        <button
          onClick={() => setFakeCallActive(true)}
          className="flex flex-col items-center justify-center p-4 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition"
        >
          <span className="text-2xl mb-1">📱</span>
          Fake Call
        </button>

        {/* Share Location */}
        <ShareLocation />

        {/* Emergency Services */}
        <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-orange-600 text-white font-semibold text-sm">
          <span className="text-2xl mb-1">👮</span>
          <a href="tel:100" className="hover:underline">Police: 100</a>
          <a href="tel:1090" className="hover:underline text-xs mt-1">Women: 1090</a>
        </div>
      </div>

      {/* Fake Call Modal */}
      {fakeCallActive && <FakeCall onDismiss={() => setFakeCallActive(false)} />}
    </div>
  );
}
