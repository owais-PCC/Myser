'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  CurrencyConfig,
  DEFAULT_CURRENCY,
  CURRENCY_KEY,
  getCurrencyConfig,
  formatCurrency as fmt,
} from '@/lib/currency';

interface CurrencyContextType {
  currency: CurrencyConfig;
  setCurrency: (code: string) => void;
  fmt: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: DEFAULT_CURRENCY,
  setCurrency: () => {},
  fmt: (n) => fmt(n, DEFAULT_CURRENCY),
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyConfig>(DEFAULT_CURRENCY);

  useEffect(() => {
    const saved = localStorage.getItem(CURRENCY_KEY);
    if (saved) setCurrencyState(getCurrencyConfig(saved));
  }, []);

  function setCurrency(code: string) {
    const cfg = getCurrencyConfig(code);
    setCurrencyState(cfg);
    localStorage.setItem(CURRENCY_KEY, code);
  }

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, fmt: (n) => fmt(n, currency) }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
