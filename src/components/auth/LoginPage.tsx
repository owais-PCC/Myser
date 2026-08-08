'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signInWithCredential, sendPasswordResetEmail } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import MyserLoader from '@/components/MyserLoader';

interface LoginPageProps {
  onSwitchToRegister: () => void;
}

// The web SDK rejects with `auth/popup-closed-by-user` /
// `auth/cancelled-popup-request`. The native Capacitor Google auth plugin
// rejects with the plain message "Authorization canceled." (American
// spelling, single L) — see
// node_modules/@capacitor-firebase/authentication/android/.../GoogleAuthProviderHandler.java.
// Checking only the British "cancelled" spelling misses the native case
// entirely, so every mobile user backing out of the account picker used to
// see a full error banner. Match both spellings, case-insensitively.
function isUserCancelledSignIn(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return msg.includes('popup-closed') || msg.includes('cancelled') || msg.includes('canceled');
}

async function nativeGoogleSignIn() {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  const result = await FirebaseAuthentication.signInWithGoogle();
  const credential = GoogleAuthProvider.credential(result.credential?.idToken);
  await signInWithCredential(auth, credential);
}

function isNativePlatform(): boolean {
  try {
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export default function LoginPage({ onSwitchToRegister }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleGoogleSignIn() {
    setError('');
    setLoading(true);
    try {
      if (isNativePlatform()) {
        await nativeGoogleSignIn();
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (e: unknown) {
      if (!isUserCancelledSignIn(e)) {
        setError(e instanceof Error ? e.message : 'Google sign-in failed');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSignIn() {
    if (!email || !password) {
      setError('Enter email and password');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed';
      if (msg.includes('invalid-credential') || msg.includes('wrong-password')) {
        setError('Invalid email or password');
      } else if (msg.includes('user-not-found')) {
        setError('No account found with this email');
      } else {
        setError('Sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email above first, then tap "Forgot password?"');
      return;
    }
    setError('');
    setResetSent(false);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to send reset email';
      if (msg.includes('user-not-found')) {
        setError('No account found with this email');
      } else if (msg.includes('invalid-email')) {
        setError('Invalid email address');
      } else {
        setError('Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ maxWidth: '400px', width: '100%', margin: '0 auto' }}>
        {/* Branding */}
        <div style={{ marginBottom: '40px' }}>
          <MyserLoader showDots={false} markSize={60} background="transparent" cycleDuration={3} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '12px', fontWeight: 500, textAlign: 'center' }}>
            Track expenses, manage budgets
          </p>
        </div>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '14px',
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontSize: '0.95rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            transition: 'all 0.15s ease',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09a7.2 7.2 0 010-4.18V7.07H2.18A11.97 11.97 0 001 12c0 1.94.46 3.77 1.18 5.43l3.66-2.84-.01-.5z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        {/* Email/Password */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            className="input-field"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ fontSize: '0.95rem' }}
          />
          <input
            className="input-field"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEmailSignIn()}
            style={{ fontSize: '0.95rem' }}
          />

          <div style={{ textAlign: 'right' }}>
            <button
              onClick={handleForgotPassword}
              disabled={loading}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              Forgot password?
            </button>
          </div>

          {resetSent && (
            <div style={{ fontSize: '0.82rem', color: 'var(--success)', fontWeight: 600, textAlign: 'center' }}>
              Password reset email sent — check your inbox.
            </div>
          )}

          {error && (
            <div style={{ fontSize: '0.82rem', color: 'var(--danger)', fontWeight: 600, textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleEmailSignIn}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        {/* Register link */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Don&apos;t have an account?{' '}
          </span>
          <button
            onClick={onSwitchToRegister}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
}
