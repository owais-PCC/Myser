'use client';

import { useState, useEffect, useCallback } from 'react';
import { checkPendingShare } from '@/lib/share-receiver';
import ShareReceiptModal from './ShareReceiptModal';

export default function ShareHandler() {
  const [sharedImage, setSharedImage] = useState<{ base64: string; mimeType: string } | null>(null);

  const check = useCallback(async () => {
    const pending = await checkPendingShare();
    if (pending) {
      setSharedImage(pending);
    }
  }, []);

  useEffect(() => {
    check();

    // Listen for app resume
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const listener = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) check();
        });
        cleanup = () => listener.remove();
      } catch {
        // Not in Capacitor environment
      }
    })();

    return () => cleanup?.();
  }, [check]);

  if (!sharedImage) return null;

  return (
    <ShareReceiptModal
      base64={sharedImage.base64}
      mimeType={sharedImage.mimeType}
      onClose={() => setSharedImage(null)}
    />
  );
}
