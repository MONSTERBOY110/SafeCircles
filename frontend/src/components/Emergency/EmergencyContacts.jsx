import React from 'react';
import { EMERGENCY_CONTACTS } from '../../utils/constants';

export default function EmergencyContacts() {
  const contacts = [
    { label: 'Police', number: EMERGENCY_CONTACTS.POLICE },
    { label: "Women's Helpline", number: EMERGENCY_CONTACTS.WOMENS_HELPLINE },
    { label: 'Ambulance', number: EMERGENCY_CONTACTS.AMBULANCE },
    { label: 'Fire', number: EMERGENCY_CONTACTS.FIRE },
  ];

  return (
    <div className="card">
      <h4 className="card-title mb-4">Emergency Contacts</h4>
      <div className="grid grid-cols-2 gap-3">
        {contacts.map((c) => (
          <a
            key={c.number}
            href={`tel:${c.number}`}
            className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-surface)] p-3 text-center transition hover:border-[var(--emergency-red)] hover:bg-[var(--emergency-red-bg)]"
          >
            <span className="block text-xs font-semibold text-[var(--text-caption)]">{c.label}</span>
            <span className="font-bold text-[var(--color-700)]">{c.number}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
