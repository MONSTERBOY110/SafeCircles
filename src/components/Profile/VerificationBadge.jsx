import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';

export default function VerificationBadge({ status }) {
  if (status === 'VERIFIED') {
    return (
      <span className="inline-flex items-center gap-1.5 bg-green-500/10 text-green-400 text-xs font-bold px-3 py-1 rounded-full mt-1 border border-green-500/20 uppercase tracking-wider">
        <CheckCircle2 className="w-3 h-3" /> Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 bg-yellow-500/10 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full mt-1 border border-yellow-500/20 uppercase tracking-wider">
      <Clock className="w-3 h-3" /> Pending Verification
    </span>
  );
}
