import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';

export default function VerificationBadge({ status }) {
  if (status === 'VERIFIED') {
    return (
      <span className="chip chip-completed mt-2">
        <CheckCircle2 size={12} /> Verified
      </span>
    );
  }
  return (
    <span className="chip chip-pending mt-2">
      <Clock size={12} /> Pending
    </span>
  );
}
