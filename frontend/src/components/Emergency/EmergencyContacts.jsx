import React, { useState } from 'react';
import { Plus, X, Phone as PhoneIcon, UserRound } from 'lucide-react';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { EMERGENCY_CONTACTS } from '../../utils/constants';

const HELPLINES = [
  { label: 'Police', number: EMERGENCY_CONTACTS.POLICE },
  { label: "Women's Helpline", number: EMERGENCY_CONTACTS.WOMENS_HELPLINE },
  { label: 'Ambulance', number: EMERGENCY_CONTACTS.AMBULANCE },
  { label: 'Fire', number: EMERGENCY_CONTACTS.FIRE },
];

const MAX_CONTACTS = 5;
const PHONE_RE = /^\+?\d[\d\s-]{6,}\d$/;

export default function EmergencyContacts() {
  const { user, userData } = useAuth();
  const personal = Array.isArray(userData?.emergency_contacts)
    ? userData.emergency_contacts
    : [];

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setShowAdd(false);
    setName('');
    setPhone('');
  };

  const handleAdd = async () => {
    if (!user) return;
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) return toast.error('Name required');
    if (!PHONE_RE.test(trimmedPhone)) return toast.error('Enter a valid phone number');
    if (personal.length >= MAX_CONTACTS) return toast.error(`Max ${MAX_CONTACTS} contacts`);

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        emergency_contacts: arrayUnion({ name: trimmedName, phone: trimmedPhone }),
      });
      toast.success('Contact added');
      reset();
    } catch (err) {
      console.error('Add contact failed:', err);
      toast.error('Could not save contact');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (contact) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        emergency_contacts: arrayRemove(contact),
      });
    } catch (err) {
      console.error('Remove contact failed:', err);
      toast.error('Could not remove contact');
    }
  };

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Personal Emergency Contacts</div>
            <div className="card-subtitle">SOS will SMS these contacts</div>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            disabled={personal.length >= MAX_CONTACTS}
            className="btn-secondary !h-9 !px-3 text-sm"
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {personal.length === 0 ? (
          <p className="empty-state-desc">
            Add up to {MAX_CONTACTS} trusted contacts. The SOS button will open a
            prefilled SMS to all of them with your live location.
          </p>
        ) : (
          <div className="space-y-2">
            {personal.map((c) => (
              <div
                key={`${c.name}-${c.phone}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-light)] bg-[var(--bg-surface)] p-3"
              >
                <a
                  href={`tel:${c.phone}`}
                  className="flex flex-1 items-center gap-3 min-w-0 hover:text-[var(--color-700)]"
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-100)] text-[var(--color-700)]">
                    <UserRound size={16} />
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className="font-semibold truncate">{c.name}</span>
                    <span className="text-xs text-[var(--text-caption)] truncate">{c.phone}</span>
                  </span>
                </a>
                <button
                  type="button"
                  onClick={() => handleRemove(c)}
                  aria-label={`Remove ${c.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-caption)] hover:bg-[var(--emergency-red-bg)] hover:text-[var(--emergency-red)]"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h4 className="card-title mb-4">Public Helplines (India)</h4>
        <div className="grid grid-cols-2 gap-3">
          {HELPLINES.map((c) => (
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

      {showAdd && (
        <div className="modal-backdrop" onClick={reset}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title mb-4">Add Emergency Contact</h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-caption)]">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mom"
                  className="input w-full mt-1"
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-caption)]">Phone</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="input w-full mt-1"
                />
                <span className="text-[10px] text-[var(--text-caption)] mt-1 block">
                  Include country code if outside India.
                </span>
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={reset}
                  disabled={saving}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  <PhoneIcon size={14} /> {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
