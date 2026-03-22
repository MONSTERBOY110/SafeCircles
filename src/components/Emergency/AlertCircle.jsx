import React from 'react';
import { useAuth } from '../../context/AuthContext';

export default function AlertCircle({ circleId, onAlert }) {
  const { user } = useAuth();

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <h4 className="font-bold text-red-700 mb-1">🚨 Alert Circle</h4>
      <p className="text-red-600 text-sm mb-3">
        This will immediately notify all circle members that you need help.
      </p>
      <button
        onClick={onAlert}
        className="w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition"
      >
        Send Emergency Alert
      </button>
    </div>
  );
}
