import React from 'react';
import { useAuth } from '../../context/AuthContext';

export default function AlertCircle({ circleId, onAlert }) {
  const { user } = useAuth();

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
      <h4 className="mb-1 font-bold text-red-300">Alert Circle</h4>
      <p className="mb-3 text-sm text-[#EAE0C8]/70">
        This will immediately notify all circle members that you need help.
      </p>
      <button
        onClick={onAlert}
        className="w-full rounded-lg bg-red-600 py-3 font-bold text-[#EAE0C8] transition hover:bg-red-500"
      >
        Send Emergency Alert
      </button>
    </div>
  );
}
