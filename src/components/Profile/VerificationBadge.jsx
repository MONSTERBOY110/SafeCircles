import React from 'react';

export default function VerificationBadge({ status }) {
  if (status === 'VERIFIED') {
    return (
      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full mt-1">
        ✅ Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs font-bold px-3 py-1 rounded-full mt-1">
      ⏳ Pending Verification
    </span>
  );
}
