'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppMode } from '@/context/AppModeContext';
import { LayoutGrid, PlusSquare, History, Wallet, BarChart3, FolderOpen } from 'lucide-react';

// Apple's home-indicator safe-area-bottom has been a fixed 34pt constant on
// every Face ID iPhone since the iPhone X (2017) — unchanged through the
// current lineup. We fall back to it explicitly rather than trust
// env(safe-area-inset-bottom) alone: a real device test showed the CSS
// value (confirmed correct via viewport-fit=cover + the calc() below,
// verified byte-for-byte in the actual tested build artifact) resolving to
// 0 anyway inside Capacitor's WKWebView — content there loads through a
// custom WKURLSchemeHandler rather than a normal navigation, a context
// where WebKit is known to sometimes fail to propagate safeAreaInsets to
// CSS env(). --ios-safe-area-bottom-fallback feeds into a max() with the
// real env() value in globals.css, so if env() ever does report correctly
// (or a future device needs a larger inset), the larger of the two wins —
// this never under-pads, and stays a no-op on Android, which isn't
// edge-to-edge in the first place (confirmed: no setDecorFitsSystemWindows
// or equivalent in MainActivity.java/styles.xml).
function applyIOSSafeAreaFallback() {
  try {
    const { Capacitor } = require('@capacitor/core');
    if (Capacitor.getPlatform() === 'ios') {
      document.documentElement.style.setProperty('--ios-safe-area-bottom-fallback', '34px');
    }
  } catch {
    // Capacitor not available (e.g. plain web) — no fallback needed.
  }
}

const BUDGET_ITEMS = [
  { href: '/dashboard', label: 'Dash', icon: LayoutGrid },
  { href: '/add', label: 'Add', icon: PlusSquare },
  { href: '/history', label: 'History', icon: History },
  { href: '/budget', label: 'Budget', icon: Wallet },
  { href: '/analytics', label: 'Stats', icon: BarChart3 },
];

const TRACKER_ITEMS = [
  { href: '/dashboard', label: 'Dash', icon: LayoutGrid },
  { href: '/add', label: 'Add', icon: PlusSquare },
  { href: '/history', label: 'History', icon: History },
  { href: '/vault', label: 'My Logs', icon: FolderOpen },
  { href: '/analytics', label: 'Stats', icon: BarChart3 },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { mode } = useAppMode();
  const items = mode === 'tracker' ? TRACKER_ITEMS : BUDGET_ITEMS;

  useEffect(() => {
    applyIOSSafeAreaFallback();
  }, []);

  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">
              <Icon size={20} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
