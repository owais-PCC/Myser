'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getPendingLogCount } from '@/lib/db';

interface NotificationContextType {
  pendingCount: number;
  processing: boolean;
  setProcessing: (v: boolean) => void;
  refreshCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  pendingCount: 0,
  processing: false,
  setProcessing: () => {},
  refreshCount: async () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [processing, setProcessing] = useState(false);

  const refreshCount = useCallback(async () => {
    const count = await getPendingLogCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  return (
    <NotificationContext.Provider value={{ pendingCount, processing, setProcessing, refreshCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
