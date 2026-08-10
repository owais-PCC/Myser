'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppMode } from '@/context/AppModeContext';
import { LayoutGrid, Plus, History, Wallet, BarChart3, FolderOpen } from 'lucide-react';

// --ios-safe-area-bottom-fallback (consumed by --nav-height / .bottom-nav
// in globals.css) used to be set here via a Capacitor.getPlatform() JS
// check with a hardcoded 34px. That's gone: a real device test showed
// env(safe-area-inset-bottom) resolving to 0 inside Capacitor's WKWebView
// regardless of the JS fallback, so the value now comes from
// ios/App/App/MainViewController.swift instead, which reads the real
// inset directly from UIKit (view.safeAreaInsets.bottom — unambiguous,
// no WebKit/CSS dependency) and pushes it into this same CSS variable via
// evaluateJavaScript. Kept as one variable/one mechanism per platform
// rather than a JS heuristic layered on top of a native one: Android
// never sets it and keeps its :root 0px default untouched.

// Add is no longer a tab in the row — it's a floating action button
// rendered separately below, shared by both platforms (no Android/iOS
// branching in either the row or the FAB).
const BUDGET_ITEMS = [
  { href: '/dashboard', label: 'Dash', icon: LayoutGrid },
  { href: '/history', label: 'History', icon: History },
  { href: '/budget', label: 'Budget', icon: Wallet },
  { href: '/analytics', label: 'Stats', icon: BarChart3 },
];

const TRACKER_ITEMS = [
  { href: '/dashboard', label: 'Dash', icon: LayoutGrid },
  { href: '/history', label: 'History', icon: History },
  { href: '/vault', label: 'My Logs', icon: FolderOpen },
  { href: '/analytics', label: 'Stats', icon: BarChart3 },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { mode } = useAppMode();
  const items = mode === 'tracker' ? TRACKER_ITEMS : BUDGET_ITEMS;
  const isAddPage = pathname === '/add';

  return (
    <>
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

      {/* Floating "Add expense" red button — sits above the bottom navbar on the right */}
      {!isAddPage && (
        <div className="nav-fab-wrapper">
          <Link href="/add" className="nav-fab-link" aria-label="Add expense">
            <span className="nav-fab">
              <Plus size={28} strokeWidth={2.8} />
            </span>
          </Link>
        </div>
      )}
    </>
  );
}
