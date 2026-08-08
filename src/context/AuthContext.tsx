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
const CACHED_USER_KEY = 'myser_cached_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);

  useEffect(() => {
    // Load cached session on mount to prevent SSR hydration mismatch
    const saved = localStorage.getItem(CACHED_USER_KEY);
    if (saved) {
      try {
        const cachedUser = JSON.parse(saved) as User;
        setUser(cachedUser);
        
        // Also load onboarding status synchronously to prevent temporary page flash
        const onboarded = localStorage.getItem(`${ONBOARDING_KEY}_${cachedUser.uid}`);
        setHasCompletedOnboarding(onboarded === 'true');
      } catch {}
    }
    setLoading(false);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const onboarded = localStorage.getItem(`${ONBOARDING_KEY}_${firebaseUser.uid}`);
        setHasCompletedOnboarding(onboarded === 'true');
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        }));
      } else {
        setHasCompletedOnboarding(false);
        setIsReturningUser(false);
        localStorage.removeItem(CACHED_USER_KEY);
      }
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
    localStorage.removeItem(CACHED_USER_KEY);
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
