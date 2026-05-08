import React, { useEffect, useState } from 'react';

export default function FakeCall({ onDismiss }) {
  const [ringing, setRinging] = useState(true);
  const [callActive, setCallActive] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setRinging(false);
    }, 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!callActive) return;
    const interval = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [callActive]);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleAnswer = () => {
    setRinging(false);
    setCallActive(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#0B132B] p-10">
      <div className="mt-12 text-center">
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-blue-600 text-4xl font-bold text-[#EAE0C8]">
          M
        </div>
        <h2 className="text-3xl font-bold text-[#EAE0C8]">Mom</h2>
        <p className="mt-2 text-lg text-[#EAE0C8]/60">
          {ringing ? 'Incoming Call...' : callActive ? `Call in progress - ${formatTime(timer)}` : 'Call ended'}
        </p>
        {callActive && (
          <p className="mt-2 text-sm italic text-[#EAE0C8]/50">"I'm calling the police right now, stay on the line."</p>
        )}
      </div>

      <div className="mb-8 flex gap-12">
        {ringing ? (
          <>
            <button
              onClick={onDismiss}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-2xl text-[#EAE0C8] shadow-lg hover:bg-red-500"
            >
              End
            </button>
            <button
              onClick={handleAnswer}
              className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-green-600 text-2xl text-[#EAE0C8] shadow-lg hover:bg-green-500"
            >
              Pick
            </button>
          </>
        ) : (
          <button
            onClick={onDismiss}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-2xl text-[#EAE0C8] shadow-lg hover:bg-red-500"
          >
            End
          </button>
        )}
      </div>
    </div>
  );
}
