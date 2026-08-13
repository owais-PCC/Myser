'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
}

export default function PageHeader({ title, showBack = true }: PageHeaderProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { open } = useDrawer();

  const initial = (user?.displayName || user?.email || 'U')[0].toUpperCase();

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {showBack && (
            <button
              onClick={() => router.back()}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: '1.2rem',
                color: 'var(--text-primary)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            </button>
          )}
          <h1 className="page-title" style={{ margin: 0 }}>{title}</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Profile picture — opens drawer */}
          <div
            onClick={open}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              overflow: 'hidden',
              cursor: 'pointer',
              flexShrink: 0,
              border: '2px solid var(--border)',
            }}
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                referrerPolicy="no-referrer"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '0.85rem',
                fontWeight: 800,
              }}>
                {initial}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
