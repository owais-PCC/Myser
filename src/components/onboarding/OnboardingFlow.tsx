'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppMode, AppMode } from '@/context/AppModeContext';
import { useCurrency } from '@/context/CurrencyContext';
import { CURRENCIES } from '@/lib/currency';
import { MyserLoader } from '@/components/MyserLoader';
import { Wallet, BarChart3 } from 'lucide-react';

const CURRENCY_ICONS: Record<string, { symbol: string; bg: string }> = {
  PKR: { symbol: 'Rs', bg: '#047857' },
  USD: { symbol: '$', bg: '#2563eb' },
  EUR: { symbol: '€', bg: '#7c3aed' },
  GBP: { symbol: '£', bg: '#dc2626' },
  JPY: { symbol: '¥', bg: '#ea580c' },
  AUD: { symbol: '$', bg: '#0891b2' },
  CAD: { symbol: '$', bg: '#dc2626' },
  CHF: { symbol: 'Fr', bg: '#dc2626' },
  AED: { symbol: 'د.إ', bg: '#047857' },
  SAR: { symbol: '﷼', bg: '#047857' },
  INR: { symbol: '₹', bg: '#ea580c' },
};

export default function OnboardingFlow() {
  const { user, completeOnboarding } = useAuth();
  const { setMode } = useAppMode();
  const { currency, setCurrency } = useCurrency();
  const [step, setStep] = useState(0);
  const [selectedMode, setSelectedMode] = useState<AppMode>('budget');
  const [selectedCurrency, setSelectedCurrency] = useState(currency.code);

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'there';

  function handleModeNext() {
    setMode(selectedMode);
    setStep(2);
  }

  function handleFinish() {
    setCurrency(selectedCurrency);
    completeOnboarding();
  }

  const StepDots = ({ current }: { current: number }) => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: i === current ? '24px' : '8px', height: '8px', borderRadius: '4px',
          background: i === current ? 'var(--accent)' : 'var(--border)', transition: 'all 0.3s ease',
        }} />
      ))}
    </div>
  );

  // Welcome
  if (step === 0) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ maxWidth: '400px', width: '100%', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ marginBottom: '24px' }}>
            <MyserLoader showDots={false} markSize={80} background="transparent" cycleDuration={3} />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px', letterSpacing: '-0.5px' }}>
            Welcome, {displayName}!
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '40px', fontWeight: 400 }}>
            Track expenses, manage budgets, and see where your money goes — all privately on your device.
          </p>
          <button className="btn-primary" onClick={() => setStep(1)}>
            Get Started
          </button>
          <StepDots current={0} />
        </div>
      </div>
    );
  }

  // Mode Selection
  if (step === 1) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ maxWidth: '400px', width: '100%', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', letterSpacing: '-0.3px' }}>
            How do you want to use Myser?
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px', fontWeight: 400 }}>
            You can change this anytime in Settings.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
            {/* Budget Mode */}
            <button
              onClick={() => setSelectedMode('budget')}
              style={{
                padding: '18px', borderRadius: '12px',
                border: selectedMode === 'budget' ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: 'var(--bg-card)', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={20} color="#1e293b" />
                </div>
                <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>Budget Mode</span>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  border: selectedMode === 'budget' ? 'none' : '2px solid var(--border)',
                  background: selectedMode === 'budget' ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selectedMode === 'budget' && <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: 800 }}>✓</span>}
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.5, margin: 0, fontWeight: 400, paddingLeft: '52px' }}>
                Set monthly budgets per category and track how much you have left.
              </p>
            </button>

            {/* Tracker Mode */}
            <button
              onClick={() => setSelectedMode('tracker')}
              style={{
                padding: '18px', borderRadius: '12px',
                border: selectedMode === 'tracker' ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: 'var(--bg-card)', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart3 size={20} color="#1e293b" />
                </div>
                <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>Tracker Mode</span>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  border: selectedMode === 'tracker' ? 'none' : '2px solid var(--border)',
                  background: selectedMode === 'tracker' ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selectedMode === 'tracker' && <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: 800 }}>✓</span>}
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.5, margin: 0, fontWeight: 400, paddingLeft: '52px' }}>
                Simply log expenses by category. See where your money goes with analytics.
              </p>
            </button>
          </div>

          <button className="btn-primary" onClick={handleModeNext}>
            Continue
          </button>
          <StepDots current={1} />
        </div>
      </div>
    );
  }

  // Currency Selection
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', padding: '48px 24px 24px' }}>
      <div style={{ maxWidth: '400px', width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <button
          onClick={() => setStep(1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontWeight: 600, fontSize: '0.9rem', padding: 0, marginBottom: '20px' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Back
        </button>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', letterSpacing: '-0.3px' }}>
          Choose your currency
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px', fontWeight: 400 }}>
          You can change this anytime in Settings.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto', marginBottom: '20px' }}>
          {CURRENCIES.map((c) => {
            const isSelected = c.code === selectedCurrency;
            const iconInfo = CURRENCY_ICONS[c.code] || { symbol: c.symbol, bg: '#6b7280' };
            return (
              <button key={c.code} onClick={() => setSelectedCurrency(c.code)} style={{
                display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '10px',
                background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', width: '100%',
              }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: iconInfo.bg, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0 }}>
                  {iconInfo.symbol}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{c.label}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '1px', fontWeight: 400 }}>{c.code}</div>
                </div>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  border: isSelected ? '6px solid var(--accent)' : '2px solid var(--border)',
                  background: 'white', flexShrink: 0,
                }} />
              </button>
            );
          })}
        </div>

        <button className="btn-primary" onClick={handleFinish}>
          Finish Setup
        </button>
        <StepDots current={2} />
      </div>
    </div>
  );
}
