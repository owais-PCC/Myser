'use client';

import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, OAuthProvider, signInWithCredential, sendPasswordResetEmail } from 'firebase/auth';
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

// @capacitor-firebase/authentication already ships native signInWithApple()
// support (confirmed in its type defs / README) — no need for the separate
// @capacitor-community/apple-sign-in package the porting guide suggested,
// which would just be a second, redundant native auth dependency.
// `credential.nonce` here is the plugin's raw (unhashed) nonce; Firebase's
// OAuthProvider.credential() expects that as `rawNonce` (it hashes/compares
// internally against what was sent to Apple).
async function nativeAppleSignIn() {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  const result = await FirebaseAuthentication.signInWithApple();
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({
    idToken: result.credential?.idToken,
    rawNonce: result.credential?.nonce,
  });
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

function isIOSPlatform(): boolean {
  try {
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.getPlatform() === 'ios';
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
  // Resolved after mount only, so SSR/client markup match (same reason
  // AuthContext reads localStorage inside useEffect rather than at render).
  const [showAppleButton, setShowAppleButton] = useState(false);

  useEffect(() => {
    setShowAppleButton(isIOSPlatform());
  }, []);

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

  async function handleAppleSignIn() {
    setError('');
    setLoading(true);
    try {
      if (isNativePlatform()) {
        await nativeAppleSignIn();
      } else {
        await signInWithPopup(auth, new OAuthProvider('apple.com'));
      }
    } catch (e: unknown) {
      if (!isUserCancelledSignIn(e)) {
        setError(e instanceof Error ? e.message : 'Apple sign-in failed');
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

        {/* Apple Sign In — iOS only (App Store Guideline 4.8 requires this
            alongside Google on the iOS binary); not shown on Android/Web. */}
        {showAppleButton && (
          <button
            onClick={handleAppleSignIn}
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '14px',
              border: 'none',
              background: '#000000',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontSize: '0.95rem',
              fontWeight: 600,
              color: '#ffffff',
              marginTop: '12px',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 384 512" fill="#ffffff">
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76-19.7C63.3 141 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
            </svg>
            Continue with Apple
          </button>
        )}

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
