import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

export default function MemberCard({ userId, isYou }) {
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    getDoc(doc(db, 'users', userId)).then((snap) => {
      if (snap.exists()) setMember(snap.data());
      setLoading(false);
    });
  }, [userId]);

  if (loading) return <div className="skeleton h-20 rounded-xl" />;
  if (!member) return null;

  return (
    <div className={`flex items-center gap-4 rounded-xl border p-4 ${isYou ? 'border-blue-400 bg-blue-500/10' : 'border-white/5 bg-[#111A3A]/70'}`}>
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-[#EAE0C8]">
        {member.name?.[0]?.toUpperCase() || '?'}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-bold text-[#EAE0C8]">{member.name || 'User'}</p>
          {isYou && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-[#EAE0C8]">You</span>}
        </div>
        <div className="mt-1 flex items-center gap-2">
          {member.verification_status === 'VERIFIED' && (
            <span className="text-xs font-semibold text-green-400">Verified</span>
          )}
          <span className="text-xs text-[#EAE0C8]/60">{member.reputation_score || 0} rep</span>
          <span className="text-xs text-[#EAE0C8]/50">{member.successful_trips || 0} trips</span>
        </div>
      </div>
    </div>
  );
}
