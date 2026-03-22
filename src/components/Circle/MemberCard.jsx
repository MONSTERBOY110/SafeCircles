import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

export default function MemberCard({ userId, isYou }) {
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    getDoc(doc(db, 'users', userId)).then(snap => {
      if (snap.exists()) setMember(snap.data());
      setLoading(false);
    });
  }, [userId]);

  if (loading) return (
    <div className="skeleton h-20 rounded-xl" />
  );
  if (!member) return null;

  return (
    <div className={`border rounded-xl p-4 flex items-center gap-4 ${isYou ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
        {member.name?.[0]?.toUpperCase() || '?'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-gray-800 truncate">
            {member.name || 'User'}
          </p>
          {isYou && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">You</span>}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {member.verification_status === 'VERIFIED' && (
            <span className="text-xs text-green-600 font-semibold">✅ Verified</span>
          )}
          <span className="text-xs text-gray-500">⭐ {member.reputation_score || 0} rep</span>
          <span className="text-xs text-gray-400">{member.successful_trips || 0} trips</span>
        </div>
      </div>
    </div>
  );
}
