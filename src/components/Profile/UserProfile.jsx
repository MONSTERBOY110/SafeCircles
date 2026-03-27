import React from 'react';
import { useAuth } from '../../context/AuthContext';
import VerificationBadge from './VerificationBadge';
import ReputationScore from './ReputationScore';
import { Star, Route } from 'lucide-react';

export default function UserProfile() {
  const { user, userData } = useAuth();
  if (!user || !userData) return null;

  return (
    <div className="bg-[#0B132B]/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-8 max-w-lg mx-auto">
      {/* Avatar */}
      <div className="flex items-center gap-5 mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-4xl font-bold flex-shrink-0 shadow-lg">
          {userData.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#eae0c8]">{userData.name}</h2>
          <p className="text-[#eae0c8]/50 text-sm">{user.email}</p>
          <VerificationBadge status={userData.verification_status} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Star className="w-5 h-5 text-yellow-400 fill-current" />
            <div className="text-3xl font-bold text-[#eae0c8]">{userData.reputation_score || 0}</div>
          </div>
          <div className="text-xs text-[#eae0c8]/40 uppercase tracking-widest font-semibold mt-1">Reputation Score</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Route className="w-5 h-5 text-green-400" />
            <div className="text-3xl font-bold text-[#eae0c8]">{userData.successful_trips || 0}</div>
          </div>
          <div className="text-xs text-[#eae0c8]/40 uppercase tracking-widest font-semibold mt-1">Safe Trips</div>
        </div>
      </div>

      <ReputationScore score={userData.reputation_score || 0} trips={userData.successful_trips || 0} />
    </div>
  );
}
