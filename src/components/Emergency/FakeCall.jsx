import React, { useEffect, useState } from 'react';

export default function FakeCall({ onDismiss }) {
  const [ringing, setRinging] = useState(true);
  const [callActive, setCallActive] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setRinging(false);
    }, 8000); // Auto-dismiss ring after 8s
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!callActive) return;
    const interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [callActive]);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleAnswer = () => {
    setRinging(false);
    setCallActive(true);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-between p-10 z-50"
      style={{ background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)' }}>

      {/* Contact Info */}
      <div className="text-center mt-12">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white text-4xl font-bold mx-auto mb-4">
          M
        </div>
        <h2 className="text-white text-3xl font-bold">Mom</h2>
        <p className="text-gray-400 text-lg mt-2">
          {ringing ? 'Incoming Call...' : callActive ? `Call in progress • ${formatTime(timer)}` : 'Call ended'}
        </p>
        {callActive && (
          <p className="text-gray-500 text-sm mt-2 italic">"I'm calling the police right now, stay on the line!"</p>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-12 mb-8">
        {ringing ? (
          <>
            <button
              onClick={onDismiss}
              className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white text-2xl shadow-lg hover:bg-red-700"
            >
              📵
            </button>
            <button
              onClick={handleAnswer}
              className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white text-2xl shadow-lg hover:bg-green-600 animate-pulse"
            >
              📞
            </button>
          </>
        ) : (
          <button
            onClick={onDismiss}
            className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white text-2xl shadow-lg hover:bg-red-700"
          >
            📵
          </button>
        )}
      </div>
    </div>
  );
}
