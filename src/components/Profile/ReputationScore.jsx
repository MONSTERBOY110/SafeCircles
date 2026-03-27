import React from 'react';
import { REPUTATION } from '../../utils/constants';
import { Trophy } from 'lucide-react';

export default function ReputationScore({ score, trips }) {
  const getTier = (s) => {
    if (s >= REPUTATION.TRUSTED) return { label: 'Trusted', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', bar: 'bg-blue-500' };
    if (s >= REPUTATION.EXPERIENCED) return { label: 'Experienced', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', bar: 'bg-purple-500' };
    return { label: 'New Member', color: 'text-[#eae0c8]/60', bg: 'bg-white/5', border: 'border-white/10', bar: 'bg-blue-500' };
  };

  const tier = getTier(score);
  const nextMilestone = score < 5 ? 5 : score < 10 ? 10 : null;
  const progress = nextMilestone ? Math.min((score / nextMilestone) * 100, 100) : 100;

  return (
    <div className={`${tier.bg} border ${tier.border} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-bold flex items-center gap-1.5 ${tier.color}`}>
          {!nextMilestone && <Trophy className="w-4 h-4" />} {tier.label}
        </span>
        <span className="text-[#eae0c8]/50 text-sm font-semibold">{score} pts</span>
      </div>
      {nextMilestone && (
        <>
          <div className="w-full bg-white/10 rounded-full h-1.5 mb-1">
            <div className={`${tier.bar} h-1.5 rounded-full transition-all`} style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-[#eae0c8]/40 font-medium">{nextMilestone - score} more trips to reach next tier</p>
        </>
      )}
      {!nextMilestone && (
        <p className={`text-xs font-semibold flex items-center gap-1.5 ${tier.color}`}>
          Maximum trust level reached
        </p>
      )}
    </div>
  );
}
