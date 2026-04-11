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
        text: 'EMERGENCY ALERT - I need help. Please stay with me.',
        sender_id: user.uid,
        sender_name: user.displayName || 'User',
        is_emergency: true,
        created_at: serverTimestamp(),
      });
      setAlertSent(true);
      toast.success('Emergency alert sent to your circle');
      setTimeout(() => setAlertSent(false), 10000);
    } catch (err) {
      toast.error('Failed to send alert. Try again.');
    }
  };

  return (
    <div className="rounded-2xl border border-white/5 bg-[#111A3A]/70 p-6 shadow-lg">
      <h3 className="mb-5 text-xl font-bold text-[#EAE0C8]">Emergency Features</h3>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={handleAlertCircle}
          disabled={alertSent}
          className={`flex flex-col items-center justify-center rounded-xl p-4 text-sm font-semibold transition ${alertSent
              ? 'border-2 border-red-400 bg-red-500/10 text-[#EAE0C8]'
              : 'bg-red-600 text-[#EAE0C8] hover:bg-red-500 emergency-pulse'
            }`}
        >
          <span className="mb-1 text-2xl">Alert</span>
          {alertSent ? 'Alert Sent' : 'Alert Circle'}
        </button>

        <button
          onClick={() => setFakeCallActive(true)}
          className="flex flex-col items-center justify-center rounded-xl bg-green-600 p-4 text-sm font-semibold text-[#EAE0C8] hover:bg-green-500 transition"
        >
          <span className="mb-1 text-2xl">Call</span>
          Fake Call
        </button>

        <ShareLocation />

        <div className="flex flex-col items-center justify-center rounded-xl bg-[#0B132B]/60 p-4 text-sm font-semibold text-[#EAE0C8] border border-blue-500/20">
          <span className="mb-1 text-2xl">Police</span>
          <a href="tel:100" className="hover:underline">Police: 100</a>
          <a href="tel:1090" className="mt-1 text-xs text-blue-300 hover:underline">Women: 1090</a>
        </div>
      </div>

      {fakeCallActive && <FakeCall onDismiss={() => setFakeCallActive(false)} />}
    </div>
  );
}
