'use client';

import { useRouter } from 'next/navigation';
import { useDrawer } from '@/context/DrawerContext';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import { FolderOpen, Wallet, Settings, Cloud, LogOut } from 'lucide-react';

export default function AppDrawer() {
  const { isOpen, close } = useDrawer();
  const { user, signOut } = useAuth();
  const { syncOn, status: syncStatus } = useSync();
  const router = useRouter();

  if (!isOpen) return null;

  const initial = (user?.displayName || user?.email || 'U')[0].toUpperCase();

  function navigate(path: string) {
    close();
    router.push(path);
  }

  async function handleSignOut() {
    close();
    await signOut();
  }

  const menuItemStyle = {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '14px',
    width: '100%',
    padding: '14px 24px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#1e293b',
    fontSize: '0.95rem',
    fontWeight: 600,
    textAlign: 'left' as const,
  };

  return (
    <>
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.4)',
          zIndex: 300, animation: 'fadeInOverlay 0.2s ease',
        }}
      />

      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '280px', maxWidth: '80vw', background: 'var(--bg-primary)',
          zIndex: 301, display: 'flex', flexDirection: 'column',
          animation: 'slideInRight 0.25s ease', boxShadow: '-8px 0 30px rgba(0,0,0,0.1)',
        }}
      >
        {/* Profile */}
        <div style={{ padding: '48px 24px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--accent)', flexShrink: 0 }}>
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.3rem', fontWeight: 800 }}>
                  {initial}
                </div>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.displayName || 'User'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email || ''}
              </div>
            </div>
          </div>
        </div>

        {/* Menu */}
        <div style={{ flex: 1, padding: '12px 0' }}>
          <button onClick={() => navigate('/vault')} style={menuItemStyle}>
            <FolderOpen size={20} color="#1e293b" />
            My Logs
          </button>

          <button onClick={() => navigate('/budget')} style={menuItemStyle}>
            <Wallet size={20} color="#1e293b" />
            Budget
          </button>

          <button onClick={() => navigate('/settings')} style={menuItemStyle}>
            <Settings size={20} color="#1e293b" />
            Settings
          </button>

          {/* Sync status */}
          <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Cloud size={20} color="#1e293b" />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Cloud Sync
              </div>
              <div style={{
                fontSize: '0.72rem', fontWeight: 700,
                color: syncOn
                  ? (syncStatus === 'synced' ? 'var(--success)' : syncStatus === 'error' ? 'var(--danger)' : 'var(--accent)')
                  : 'var(--text-muted)',
              }}>
                {syncOn ? (syncStatus === 'synced' ? 'Synced' : syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Error' : 'On') : 'Off'}
              </div>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleSignOut} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            width: '100%', padding: '12px', background: 'rgba(220, 38, 38, 0.06)',
            border: '1px solid rgba(220, 38, 38, 0.15)', borderRadius: '12px',
            color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
          }}>
            <LogOut size={16} color="#dc2626" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
