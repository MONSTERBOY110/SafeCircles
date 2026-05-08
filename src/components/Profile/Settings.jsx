import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { LogOut, Bell, MapPin, ShieldCheck } from 'lucide-react';

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
    <div className="bg-[#111A3A]/70 backdrop-blur-md border border-white/5 rounded-2xl shadow-xl p-6 max-w-lg mx-auto">
      <h3 className="text-xl font-bold text-[#eae0c8] mb-5 uppercase tracking-widest text-sm">Settings</h3>

      <div className="space-y-1">
        <div className="flex items-center justify-between py-3.5 border-b border-white/5">
          <span className="text-[#eae0c8]/80 font-medium flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-[#eae0c8]/40" /> Notifications
          </span>
          <span className="text-green-400 text-xs font-bold uppercase tracking-wider bg-green-500/10 px-2 py-1 rounded-md border border-green-500/20">Enabled</span>
        </div>
        <div className="flex items-center justify-between py-3.5 border-b border-white/5">
          <span className="text-[#eae0c8]/80 font-medium flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-[#eae0c8]/40" /> Location Tracking
          </span>
          <span className="text-blue-400 text-xs font-bold uppercase tracking-wider bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">Active during trips</span>
        </div>
        <div className="flex items-center justify-between py-3.5 border-b border-white/5">
          <span className="text-[#eae0c8]/80 font-medium flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#eae0c8]/40" /> Privacy Mode
          </span>
          <span className="text-blue-400 text-xs font-bold uppercase tracking-wider bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">Geohash-rounded</span>
        </div>
      </div>

      <button
        onClick={handleLogout}
        disabled={loading}
        className="w-full mt-6 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold py-3.5 rounded-xl transition-all uppercase tracking-widest text-sm disabled:opacity-50"
      >
        <LogOut className="w-4 h-4" />
        {loading ? 'Logging out...' : 'Log Out'}
      </button>
    </div>
  );
}
