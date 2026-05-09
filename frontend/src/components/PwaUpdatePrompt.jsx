import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import toast from 'react-hot-toast';

export default function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) {
      // eslint-disable-next-line no-console
      console.warn('[pwa] SW registration failed:', err);
    },
  });

  useEffect(() => {
    if (!needRefresh) return undefined;
    const id = toast(
      (t) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          <span>New version available</span>
          <button
            onClick={() => {
              updateServiceWorker(true);
              toast.dismiss(t.id);
              setNeedRefresh(false);
            }}
            style={{
              borderRadius: 6,
              background: '#2563eb',
              color: '#EAE0C8',
              padding: '4px 12px',
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </span>
      ),
      { duration: Infinity, id: 'pwa-update' }
    );
    return () => toast.dismiss(id);
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}
