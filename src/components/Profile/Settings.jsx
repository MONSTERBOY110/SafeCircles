import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function Settings() {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      toast.success('Logged out successfully');
    } catch {
      toast.error('Logout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 max-w-lg mx-auto">
      <h3 className="text-xl font-bold text-gray-800 mb-5">Settings</h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <span className="text-gray-700 font-medium">Notifications</span>
          <span className="text-green-600 text-sm font-semibold">Enabled</span>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <span className="text-gray-700 font-medium">Location Tracking</span>
          <span className="text-green-600 text-sm font-semibold">Active during trips</span>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <span className="text-gray-700 font-medium">Privacy Mode</span>
          <span className="text-blue-600 text-sm font-semibold">Geohash-rounded</span>
        </div>
      </div>

      <button
        onClick={handleLogout}
        disabled={loading}
        className="w-full mt-6 btn-danger disabled:opacity-50"
      >
        {loading ? 'Logging out...' : '🚪 Log Out'}
      </button>
    </div>
  );
}
