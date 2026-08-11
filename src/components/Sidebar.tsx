'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppMode } from '@/context/AppModeContext';
import { useAuth } from '@/context/AuthContext';
import { isSyncEnabled } from '@/lib/firestore-sync';
import AddExpenseModal from '@/components/AddExpenseModal';
import {
  LayoutGrid,
  History,
  Wallet,
  BarChart3,
  FolderOpen,
  Settings as SettingsIcon,
  Plus,
  Cloud,
  CloudOff,
  User,
} from 'lucide-react';

const BUDGET_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/history', label: 'History', icon: History },
  { href: '/budget', label: 'Budget', icon: Wallet },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/vault', label: 'Document Vault', icon: FolderOpen },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

const TRACKER_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/history', label: 'History', icon: History },
  { href: '/vault', label: 'My Logs', icon: FolderOpen },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { mode } = useAppMode();
  const { user } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);

  const items = mode === 'tracker' ? TRACKER_ITEMS : BUDGET_ITEMS;
  const isCloudOn = isSyncEnabled();

  return (
    <>
      <aside className="desktop-sidebar">
        {/* Brand Header */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
          <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #047857, #065f46)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 900,
                fontSize: '1.2rem',
                boxShadow: '0 4px 14px rgba(4, 120, 87, 0.3)',
              }}
            >
              M
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1 }}>
                <span style={{ color: '#047857' }}>My</span>
                <span style={{ color: '#52666f' }}>ser</span>
              </div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase', marginTop: '3px' }}>
                Personal Wealth
              </div>
            </div>
          </Link>
        </div>

        {/* Quick CTA */}
        <div style={{ padding: '16px 20px 8px' }}>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '0.95rem',
              fontWeight: 800,
              boxShadow: '0 6px 20px rgba(4, 120, 87, 0.25)',
            }}
          >
            <Plus size={18} strokeWidth={2.8} />
            <span>Log Expense</span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {items.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  fontSize: '0.92rem',
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={20} color={isActive ? 'var(--accent)' : 'var(--text-secondary)'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Sync Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
              ) : (
                <User size={18} color="var(--text-secondary)" />
              )}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.displayName || 'Local User'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {isCloudOn ? <Cloud size={11} color="var(--accent)" /> : <CloudOff size={11} color="var(--text-muted)" />}
                <span>{isCloudOn ? 'Cloud Synced' : 'Local Storage'}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Add Expense Modal */}
      <AddExpenseModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </>
  );
}
