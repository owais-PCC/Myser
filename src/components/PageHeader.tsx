'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';
import { useNotifications } from '@/context/NotificationContext';
import NotificationsPanel from './NotificationsPanel';

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
}

export default function PageHeader({ title, showBack = true }: PageHeaderProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { open } = useDrawer();
  const { pendingCount, processing } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

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
          {/* Notification bell */}
          <button
            onClick={() => setShowNotifications(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
            }}
          >
            {processing ? (
              <div style={{ width: '20px', height: '20px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
              </svg>
            )}
            {pendingCount > 0 && !processing && (
              <span style={{
                position: 'absolute',
                top: '0',
                right: '0',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: 'var(--danger)',
                color: 'white',
                fontSize: '0.6rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {pendingCount}
              </span>
            )}
          </button>

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

      <NotificationsPanel isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
    </>
  );
}
