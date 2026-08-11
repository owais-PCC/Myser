'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import LoginPage from '@/components/auth/LoginPage';
import RegisterPage from '@/components/auth/RegisterPage';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';
import MyserLoader from '@/components/MyserLoader';
import { runRecurringCatchUp } from '@/lib/db';

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, hasCompletedOnboarding, isReturningUser } = useAuth();
  const { status: syncStatus } = useSync();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const ranCatchUp = useRef(false);

  const ready = !loading && !!user && syncStatus !== 'syncing' && (hasCompletedOnboarding || isReturningUser);

  // Auto-repeat transactions (MYS-11) have no server/background scheduler —
  // catch up on any occurrences that came due since the app was last
  // opened, once per session, right as the real app content becomes
  // reachable.
  useEffect(() => {
    if (ready && !ranCatchUp.current) {
      ranCatchUp.current = true;
      runRecurringCatchUp().catch((e) => console.error('[RecurringCatchUp] Failed:', e));
    }
  }, [ready]);

  if (loading) {
    return <MyserLoader fullScreen background="var(--bg-primary)" markSize={80} />;
  }

  if (!user) {
    if (authView === 'register') {
      return <RegisterPage onSwitchToLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onSwitchToRegister={() => setAuthView('register')} />;
  }

  if (syncStatus === 'syncing') {
    return <MyserLoader fullScreen background="var(--bg-primary)" markSize={80} />;
  }

  if (!hasCompletedOnboarding && !isReturningUser) {
    return <OnboardingFlow />;
  }

  return <>{children}</>;
}
