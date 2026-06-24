'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type AppMode = 'budget' | 'tracker';

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const AppModeContext = createContext<AppModeContextType>({
  mode: 'budget',
  setMode: () => {},
});

const MODE_KEY = 'financeapp_mode';

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>('budget');

  useEffect(() => {
    const saved = localStorage.getItem(MODE_KEY) as AppMode | null;
    if (saved === 'budget' || saved === 'tracker') {
      setModeState(saved);
    }
  }, []);

  function setMode(newMode: AppMode) {
    setModeState(newMode);
    localStorage.setItem(MODE_KEY, newMode);
  }

  return (
    <AppModeContext.Provider value={{ mode, setMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  return useContext(AppModeContext);
}
