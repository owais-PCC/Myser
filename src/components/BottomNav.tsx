'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppMode } from '@/context/AppModeContext';
import { LayoutGrid, PlusSquare, History, Wallet, BarChart3, FolderOpen } from 'lucide-react';

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
