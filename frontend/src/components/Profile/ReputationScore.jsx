import React from 'react';
import { REPUTATION } from '../../utils/constants';
import { Trophy } from 'lucide-react';

export default function ReputationScore({ score, trips }) {
  const getTier = (s) => {
    if (s >= REPUTATION.TRUSTED) return { label: 'Trusted', color: 'text-[var(--color-700)]', bar: 'bg-[var(--color-700)]' };
    if (s >= REPUTATION.EXPERIENCED) return { label: 'Experienced', color: 'text-[var(--color-600)]', bar: 'bg-[var(--color-600)]' };
    return { label: 'New Member', color: 'text-[var(--text-caption)]', bar: 'bg-[var(--color-500)]' };
  };

  const tier = getTier(score);
  const nextMilestone = score < 5 ? 5 : score < 10 ? 10 : null;
  const progress = nextMilestone ? Math.min((score / nextMilestone) * 100, 100) : 100;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <span className={`font-bold flex items-center gap-1.5 ${tier.color}`}>
          {!nextMilestone && <Trophy className="w-4 h-4" />} {tier.label}
        </span>
        <span className="text-[var(--text-caption)] text-sm font-semibold">{score} pts</span>
      </div>
      {nextMilestone && (
        <>
          <div className="w-full bg-[var(--color-100)] rounded-full h-1.5 mb-1">
            <div className={`${tier.bar} h-1.5 rounded-full transition-all`} style={{ width: `${progress}%` }} />
          </div>
          <p className="card-subtitle">{nextMilestone - score} more trips to reach next tier</p>
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
