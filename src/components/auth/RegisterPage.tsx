'use client';

import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import MyserLoader from '@/components/MyserLoader';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
}

export default function RegisterPage({ onSwitchToLogin }: RegisterPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name.trim()) { setError('Enter your name'); return; }
    if (!email) { setError('Enter your email'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setError('');
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name.trim() });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Registration failed';
      if (msg.includes('email-already-in-use')) {
        setError('An account with this email already exists');
      } else if (msg.includes('invalid-email')) {
        setError('Invalid email address');
      } else {
        setError('Registration failed. Please try again.');
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
            Create your account
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            className="input-field"
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ fontSize: '0.95rem' }}
          />
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
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ fontSize: '0.95rem' }}
          />
          <input
            className="input-field"
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
            style={{ fontSize: '0.95rem' }}
          />

          {error && (
            <div style={{ fontSize: '0.82rem', color: 'var(--danger)', fontWeight: 600, textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Already have an account?{' '}
          </span>
          <button
            onClick={onSwitchToLogin}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
