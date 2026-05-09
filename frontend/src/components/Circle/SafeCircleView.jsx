import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import MemberCard from './MemberCard';
import CircleMap from './CircleMap';
import CircleChat from './CircleChat';
import EmergencyButtons from '../Emergency/EmergencyButtons';

export default function SafeCircleView({ circleId }) {
  const [circleData, setCircleData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!circleId) return;
    const unsub = onSnapshot(doc(db, 'safe_circles', circleId), (snap) => {
      if (snap.exists()) setCircleData({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
    return unsub;
  }, [circleId]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="animate-pulse text-xl text-[#EAE0C8]/50">Loading circle...</div>
      </div>
    );
  }

  if (!circleData) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-xl text-red-400">Circle not found</div>
      </div>
    );
  }

  const user = auth.currentUser;

  return (
    <div className="min-h-screen bg-[#0B132B] py-8">
      <div className="container-max space-y-6">
        <div className="rounded-2xl bg-blue-600/90 p-6 text-[#EAE0C8]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="mb-1 text-2xl font-bold">Your Safe Circle</h2>
              <p className="text-sm text-[#EAE0C8]/80">{circleData.route_summary}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{circleData.member_ids?.length || 0}</div>
              <div className="text-xs text-[#EAE0C8]/70">members</div>
            </div>
          </div>
        </div>

        {circleData.meeting_point && (
          <div className="rounded-xl border-l-4 border-blue-500 bg-[#111A3A]/70 p-5">
            <h3 className="mb-1 flex items-center gap-2 font-bold text-[#EAE0C8]">Meeting Point</h3>
            <p className="text-lg font-semibold text-[#EAE0C8]">{circleData.meeting_point.name}</p>
            <div className="mt-2 flex gap-4 text-sm text-[#EAE0C8]/60">
              {circleData.meeting_point.cctv_coverage && <span>CCTV Coverage</span>}
              {circleData.meeting_point.police_booth_nearby && <span>Police Booth Nearby</span>}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-white/5 bg-[#111A3A]/70 p-5 shadow">
          <h3 className="mb-4 font-bold text-[#EAE0C8]">Route Map</h3>
          <CircleMap circleData={circleData} />
        </div>

        <div className="rounded-xl border border-white/5 bg-[#111A3A]/70 p-5 shadow">
          <h3 className="mb-4 font-bold text-[#EAE0C8]">Circle Members ({circleData.member_ids?.length || 0})</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(circleData.member_ids || []).map((memberId) => (
              <MemberCard
                key={memberId}
                userId={memberId}
                isYou={memberId === user?.uid}
              />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#111A3A]/70 p-5 shadow">
          <h3 className="mb-4 font-bold text-[#EAE0C8]">Group Chat</h3>
          <CircleChat circleId={circleId} />
        </div>

        <EmergencyButtons circleId={circleId} />
      </div>
    </div>
  );
}
