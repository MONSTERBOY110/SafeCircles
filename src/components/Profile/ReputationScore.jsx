import React from 'react';
import { REPUTATION } from '../../utils/constants';

export default function ReputationScore({ score, trips }) {
  const getTier = (s) => {
    if (s >= REPUTATION.TRUSTED) return { label: 'Trusted', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (s >= REPUTATION.EXPERIENCED) return { label: 'Experienced', color: 'text-purple-600', bg: 'bg-purple-50' };
    return { label: 'New Member', color: 'text-gray-600', bg: 'bg-gray-50' };
  };

  const tier = getTier(score);
  const nextMilestone = score < 5 ? 5 : score < 10 ? 10 : null;
  const progress = nextMilestone ? Math.min((score / nextMilestone) * 100, 100) : 100;

  return (
    <div className={`${tier.bg} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-bold ${tier.color}`}>{tier.label}</span>
        <span className="text-gray-500 text-sm">{score} pts</span>
      </div>
      {nextMilestone && (
        <>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-400">{nextMilestone - score} more trips to reach next tier</p>
        </>
      )}
      {!nextMilestone && (
        <p className="text-xs text-blue-500 font-semibold">🏆 Maximum trust level reached!</p>
      )}
    </div>
  );
}
