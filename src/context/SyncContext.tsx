'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { isSyncEnabled, setSyncEnabled, uploadAllData, pullFromCloud, hasCloudData, pullDocumentsFromCloud } from '@/lib/firestore-sync';
import { useAuth } from './AuthContext';

type SyncStatus = 'idle' | 'checking' | 'syncing' | 'synced' | 'error';

interface SyncContextType {
  syncOn: boolean;
  status: SyncStatus;
  enableSync: () => Promise<void>;
  disableSync: () => void;
}

const SyncContext = createContext<SyncContextType>({
  syncOn: false,
  status: 'idle',
  enableSync: async () => {},
  disableSync: () => {},
});

const LAST_UID_KEY = 'myser_last_uid';

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, markAsReturning } = useAuth();
  const [syncOn, setSyncOn] = useState(false);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const lastCheckedUid = useRef<string | null>(null);

  useEffect(() => {
    setSyncOn(isSyncEnabled());
  }, []);

  const checkAndPull = useCallback(async () => {
    if (!user || authLoading) return;
    if (lastCheckedUid.current === user.uid) return;

    lastCheckedUid.current = user.uid;

    // Check if this is the same user who was last logged in
    const lastUid = localStorage.getItem(LAST_UID_KEY);
    const isSameUser = lastUid === user.uid;

    // Save current user as last logged in
    localStorage.setItem(LAST_UID_KEY, user.uid);

    // If same user and sync flag is set, we're good — data is already local
    if (isSameUser && isSyncEnabled()) {
      setStatus('synced');
      setSyncOn(true);
      return;
    }

    // If same user but sync off, just idle
    if (isSameUser) {
      setStatus('idle');
      return;
    }

    // Different user or first login — always check cloud
    setStatus('checking');
    try {
      const cloudExists = await hasCloudData(user.uid);

      if (cloudExists) {
        setStatus('syncing');
        await pullFromCloud(user.uid);
        await pullDocumentsFromCloud(user.uid);
        setSyncEnabled(true);
        setSyncOn(true);
        markAsReturning();
        setStatus('synced');
      } else {
        setStatus('idle');
      }
    } catch {
      // Reset the dedupe guard so a transient failure (network blip, or the
      // Firebase SDK's internal auth token not fully attached yet right
      // after this uid first became current) doesn't permanently lock this
      // uid out of ever retrying — without this, the only recovery used to
      // be a full app reload.
      lastCheckedUid.current = null;
      setStatus('error');
    }
  }, [user, authLoading, markAsReturning]);

  useEffect(() => {
    checkAndPull();
  }, [checkAndPull]);

  // Retry automatically once the device comes back online, since a
  // network-blip failure would otherwise sit in 'error' until the user
  // manually reloads the app.
  useEffect(() => {
    function handleOnline() {
      checkAndPull();
    }
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [checkAndPull]);

  async function enableSync() {
    if (!user) return;
    setStatus('syncing');
    try {
      await uploadAllData(user.uid);
      setSyncEnabled(true);
      setSyncOn(true);
      setStatus('synced');
    } catch {
      setStatus('error');
    }
  }

  function disableSync() {
    setSyncEnabled(false);
    setSyncOn(false);
    setStatus('idle');
  }

  return (
    <SyncContext.Provider value={{ syncOn, status, enableSync, disableSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}
