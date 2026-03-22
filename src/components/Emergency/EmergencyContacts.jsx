import React from 'react';
import { EMERGENCY_CONTACTS } from '../../utils/constants';

export default function EmergencyContacts() {
  const contacts = [
    { label: '🚔 Police', number: EMERGENCY_CONTACTS.POLICE },
    { label: '👩 Women\'s Helpline', number: EMERGENCY_CONTACTS.WOMENS_HELPLINE },
    { label: '🚑 Ambulance', number: EMERGENCY_CONTACTS.AMBULANCE },
    { label: '🔥 Fire', number: EMERGENCY_CONTACTS.FIRE },
  ];

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <h4 className="font-bold text-gray-800 mb-4">📞 Emergency Contacts</h4>
      <div className="grid grid-cols-2 gap-3">
        {contacts.map(c => (
          <a
            key={c.number}
            href={`tel:${c.number}`}
            className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-xl hover:bg-red-50 hover:border-red-300 transition text-center"
          >
            <span className="text-xl mb-1">{c.label.split(' ')[0]}</span>
            <span className="text-xs font-semibold text-gray-700">{c.label.split(' ').slice(1).join(' ')}</span>
            <span className="text-blue-600 font-bold">{c.number}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
