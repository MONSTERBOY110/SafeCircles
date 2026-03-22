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

  if (loading) return (
    <div className="flex justify-center items-center min-h-[400px]">
      <div className="text-xl text-gray-500 animate-pulse">Loading circle...</div>
    </div>
  );

  if (!circleData) return (
    <div className="flex justify-center items-center min-h-[400px]">
      <div className="text-xl text-red-500">Circle not found</div>
    </div>
  );

  const user = auth.currentUser;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-max space-y-6">

        {/* Circle Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-1">🛡️ Your Safe Circle</h2>
              <p className="text-blue-100 text-sm">{circleData.route_summary}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{circleData.member_ids?.length || 0}</div>
              <div className="text-blue-200 text-xs">members</div>
            </div>
          </div>
        </div>

        {/* Meeting Point */}
        {circleData.meeting_point && (
          <div className="bg-blue-50 border-l-4 border-blue-600 p-5 rounded-xl">
            <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2">📍 Meeting Point</h3>
            <p className="text-lg font-semibold text-gray-800">{circleData.meeting_point.name}</p>
            <div className="flex gap-4 mt-2 text-sm text-gray-600">
              {circleData.meeting_point.cctv_coverage && <span>🎥 CCTV Coverage</span>}
              {circleData.meeting_point.police_booth_nearby && <span>👮 Police Booth Nearby</span>}
            </div>
          </div>
        )}

        {/* Map */}
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-bold text-gray-800 mb-4">Route Map</h3>
          <CircleMap circleData={circleData} />
        </div>

        {/* Members */}
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-bold text-gray-800 mb-4">
            Circle Members ({circleData.member_ids?.length || 0})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(circleData.member_ids || []).map(memberId => (
              <MemberCard
                key={memberId}
                userId={memberId}
                isYou={memberId === user?.uid}
              />
            ))}
          </div>
        </div>

        {/* Chat */}
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-bold text-gray-800 mb-4">Group Chat</h3>
          <CircleChat circleId={circleId} />
        </div>

        {/* Emergency */}
        <EmergencyButtons circleId={circleId} />
      </div>
    </div>
  );
}
