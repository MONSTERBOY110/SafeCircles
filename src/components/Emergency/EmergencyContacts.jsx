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
    <div className="rounded-xl border border-white/5 bg-[#111A3A]/70 p-5 shadow">
      <h4 className="mb-4 font-bold text-[#EAE0C8]">Emergency Contacts</h4>
      <div className="grid grid-cols-2 gap-3">
        {contacts.map((c) => (
          <a
            key={c.number}
            href={`tel:${c.number}`}
            className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-[#0B132B]/60 p-3 text-center transition hover:border-red-500/40 hover:bg-red-500/10"
          >
            <span className="text-xs font-semibold text-[#EAE0C8]/70">{c.label}</span>
            <span className="font-bold text-blue-300">{c.number}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
