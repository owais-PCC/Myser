'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { clearAllUserData } from '@/lib/clear-user-data';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  hasCompletedOnboarding: boolean;
  isReturningUser: boolean;
  completeOnboarding: () => void;
  markAsReturning: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  hasCompletedOnboarding: false,
  isReturningUser: false,
  completeOnboarding: () => {},
  markAsReturning: () => {},
  signOut: async () => {},
});

const ONBOARDING_KEY = 'myser_onboarding_complete';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const onboarded = localStorage.getItem(`${ONBOARDING_KEY}_${firebaseUser.uid}`);
        setHasCompletedOnboarding(onboarded === 'true');
      } else {
        setHasCompletedOnboarding(false);
        setIsReturningUser(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  function completeOnboarding() {
    if (user) {
      localStorage.setItem(`${ONBOARDING_KEY}_${user.uid}`, 'true');
      setHasCompletedOnboarding(true);
    }
  }

  function markAsReturning() {
    setIsReturningUser(true);
    if (user) {
      localStorage.setItem(`${ONBOARDING_KEY}_${user.uid}`, 'true');
      setHasCompletedOnboarding(true);
    }
  }

  async function signOut() {
    clearAllUserData();
    await firebaseSignOut(auth);
    setUser(null);
    setHasCompletedOnboarding(false);
    setIsReturningUser(false);
  }

  return (
    <AuthContext.Provider value={{ user, loading, hasCompletedOnboarding, isReturningUser, completeOnboarding, markAsReturning, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
