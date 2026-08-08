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
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  hasCompletedOnboarding: false,
  isReturningUser: false,
  completeOnboarding: () => {},
  markAsReturning: () => {},
  signOut: async () => {},
  refreshUser: async () => {},
});

const ONBOARDING_KEY = 'myser_onboarding_complete';
const CACHED_USER_KEY = 'myser_cached_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);

  useEffect(() => {
    // Load cached session on mount to prevent SSR hydration mismatch.
    // NOTE: this is a deliberate offline-first trade-off — we trust this
    // cached snapshot as "logged in" before Firebase's onAuthStateChanged
    // below has confirmed the session is still valid. If the real session
    // has been revoked/expired, the UI briefly (or, offline, indefinitely)
    // shows the authenticated shell. This is intentional: local SQLite data
    // isn't gated by Firebase, and real cloud reads/writes still require a
    // live token per Firestore security rules, so nothing sensitive leaks —
    // it just means "loading" here means "checked local cache", not
    // "verified with Firebase".
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
    // Attempt the remote sign-out first. Regardless of whether it succeeds,
    // the user's intent is to be logged out locally — but we must not wipe
    // local data (clearAllUserData) until after we've at least tried the
    // remote call, so a transient failure here doesn't destroy local state
    // while leaving Firebase's session (and our own `user` state) intact.
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Firebase sign-out failed, continuing with local sign-out:', err);
    } finally {
      clearAllUserData();
      localStorage.removeItem(CACHED_USER_KEY);
      setUser(null);
      setHasCompletedOnboarding(false);
      setIsReturningUser(false);
    }
  }

  // Re-reads auth.currentUser and pushes it into context + the localStorage
  // cache. Needed because some SDK calls (e.g. updateProfile) mutate the
  // current user without re-firing onAuthStateChanged, so context would
  // otherwise go stale until the next full sign-in.
  async function refreshUser() {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    const refreshed = auth.currentUser;
    setUser(refreshed);
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify({
      uid: refreshed.uid,
      email: refreshed.email,
      displayName: refreshed.displayName,
      photoURL: refreshed.photoURL,
    }));
  }

  return (
    <AuthContext.Provider value={{ user, loading, hasCompletedOnboarding, isReturningUser, completeOnboarding, markAsReturning, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
