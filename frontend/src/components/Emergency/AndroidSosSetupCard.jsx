import React from 'react';
import { ShieldAlert, ExternalLink, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const STEPS = [
  'Open Settings → Safety & emergency → Emergency SOS.',
  'Turn it on and add your trusted contacts.',
  'Choose "Press the Power button 5 times" (or 3 on some phones).',
  'When activated it auto-sends your location by SMS — even if SafeCircles is closed.',
];

export default function AndroidSosSetupCard() {
  const open = () => {
    // Best-effort intent for Android Chrome. Most builds reject web-initiated
    // intents to system Settings; the visible steps below are the real
    // instructions either way.
    const intent =
      'intent://settings/safety_and_emergency#Intent;scheme=android-app;end';
    try {
      window.location.href = intent;
    } catch {
      /* swallow */
    }
    setTimeout(() => {
      toast('If Settings did not open, follow the steps above.', { duration: 4500 });
    }, 800);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--emergency-red-bg)] text-[var(--emergency-red)]">
            <ShieldAlert size={20} />
          </span>
          <div>
            <div className="card-title">Phone Emergency SOS</div>
            <div className="card-subtitle">
              Power-button-triple-press SOS — works even if SafeCircles is closed.
            </div>
          </div>
        </div>
      </div>
      <ol className="space-y-2 text-sm leading-relaxed mb-4">
        {STEPS.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="flex-shrink-0 mt-0.5 font-bold text-[var(--color-700)]">
              {i + 1}.
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={open}
        className="btn-secondary w-full inline-flex items-center justify-center gap-2"
      >
        <ExternalLink size={16} /> Open Android Settings
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
