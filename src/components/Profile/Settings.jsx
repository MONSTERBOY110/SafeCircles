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
    <div className="profile-details-card">
      <div className="px-4 pt-4">
        <h3 className="section-title">Settings</h3>
      </div>

      <div>
        <div className="profile-detail-row">
          <span className="detail-icon"><Bell size={18} /></span>
          <span className="detail-value flex-1">
            Notifications
          </span>
          <span className="chip chip-completed">Enabled</span>
        </div>
        <div className="profile-detail-row">
          <span className="detail-icon"><MapPin size={18} /></span>
          <span className="detail-value flex-1">
            Location Tracking
          </span>
          <span className="chip chip-matched">Trip only</span>
        </div>
        <div className="profile-detail-row">
          <span className="detail-icon"><ShieldCheck size={18} /></span>
          <span className="detail-value flex-1">
            Privacy Mode
          </span>
          <span className="chip chip-matched">Geohash</span>
        </div>
      </div>

      <button
        onClick={handleLogout}
        disabled={loading}
        className="btn-danger m-4 w-[calc(100%-32px)]"
      >
        <LogOut size={16} />
        {loading ? 'Logging out...' : 'Log Out'}
      </button>
    </div>
  );
}
