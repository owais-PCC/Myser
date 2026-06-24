'use client';

import { useState, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import LoginPage from '@/components/auth/LoginPage';
import RegisterPage from '@/components/auth/RegisterPage';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';
import MyserLoader from '@/components/MyserLoader';

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, hasCompletedOnboarding, isReturningUser } = useAuth();
  const { status: syncStatus } = useSync();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

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
