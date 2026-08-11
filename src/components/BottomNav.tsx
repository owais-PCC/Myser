'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppMode } from '@/context/AppModeContext';
import AddExpenseModal from '@/components/AddExpenseModal';
import { LayoutGrid, Plus, History, Wallet, BarChart3, FolderOpen } from 'lucide-react';

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
  const [showAddModal, setShowAddModal] = useState(false);
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

      {/* Floating "Add expense" red button — opens bottom sheet modal */}
      {!isAddPage && (
        <div className="nav-fab-wrapper">
          <button
            onClick={() => setShowAddModal(true)}
            className="nav-fab-link"
            aria-label="Add expense"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <span className="nav-fab">
              <Plus size={28} strokeWidth={2.8} />
            </span>
          </button>
        </div>
      )}

      {/* Instant Add Expense Bottom Sheet Modal */}
      <AddExpenseModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </>
  );
}
