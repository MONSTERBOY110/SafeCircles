import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { timeAgo } from '../../utils/timeUtils';

export default function CircleChat({ circleId }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const user = auth.currentUser;

  useEffect(() => {
    if (!circleId) return;
    const q = query(
      collection(db, 'safe_circles', circleId, 'messages'),
      orderBy('created_at', 'asc'),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    return unsub;
  }, [circleId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'safe_circles', circleId, 'messages'), {
        text: newMessage.trim(),
        sender_id: user.uid,
        sender_name: user.displayName || 'User',
        created_at: serverTimestamp(),
      });
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col" style={{ height: 360 }}>
      <div className="mb-4 flex-1 space-y-3 overflow-y-auto pr-2">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-[#EAE0C8]/50">No messages yet. Say hi.</p>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === user?.uid;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-blue-600 text-[#EAE0C8]' : 'bg-[#111A3A] text-[#EAE0C8] border border-white/5'}`}>
                {!isMe && <p className="mb-1 text-xs font-semibold text-[#EAE0C8]/50">{msg.sender_name}</p>}
                <p>{msg.text}</p>
                {msg.created_at && (
                  <p className={`mt-1 text-xs ${isMe ? 'text-blue-200' : 'text-[#EAE0C8]/40'}`}>
                    {timeAgo(msg.created_at)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="input-field flex-1 py-2 text-sm"
          maxLength={300}
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
