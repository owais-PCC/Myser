'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppMode } from '@/context/AppModeContext';
import AddExpenseModal from '@/components/AddExpenseModal';
import ShareReceiptModal from '@/components/ShareReceiptModal';
import { LayoutGrid, Plus, History, Wallet, BarChart3, FolderOpen, Receipt, PencilLine } from 'lucide-react';

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
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [receiptData, setReceiptData] = useState<{ base64: string; mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const items = mode === 'tracker' ? TRACKER_ITEMS : BUDGET_ITEMS;
  const isAddPage = pathname === '/add';

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const mimeType = file.type || 'image/jpeg';
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64Data = res.includes(',') ? res.split(',')[1] : res;
      setReceiptData({ base64: base64Data, mimeType });
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

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

      {/* Speed Dial Backdrop */}
      {speedDialOpen && !isAddPage && (
        <div className="fab-backdrop" onClick={() => setSpeedDialOpen(false)} />
      )}

      {/* Speed Dial Action Menu */}
      {speedDialOpen && !isAddPage && (
        <div className="speed-dial-menu">
          {/* Action 1: Upload Receipt */}
          <div
            className="speed-dial-item"
            style={{ animationDelay: '0.04s' }}
            onClick={() => {
              setSpeedDialOpen(false);
              fileInputRef.current?.click();
            }}
          >
            <span>Upload Receipt</span>
            <div className="speed-dial-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
              <Receipt size={18} />
            </div>
          </div>

          {/* Action 2: Manual Entry */}
          <div
            className="speed-dial-item"
            style={{ animationDelay: '0s' }}
            onClick={() => {
              setSpeedDialOpen(false);
              setShowAddModal(true);
            }}
          >
            <span>Manual Entry</span>
            <div className="speed-dial-icon" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
              <PencilLine size={18} />
            </div>
          </div>
        </div>
      )}

      {/* Floating "Add expense" red button */}
      {!isAddPage && (
        <div className="nav-fab-wrapper">
          <button
            onClick={() => setSpeedDialOpen(!speedDialOpen)}
            className="nav-fab-link"
            aria-label="Add expense"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <span
              className="nav-fab"
              style={{
                transform: speedDialOpen ? 'rotate(135deg)' : 'rotate(0deg)',
              }}
            >
              <Plus size={28} strokeWidth={2.8} />
            </span>
          </button>
        </div>
      )}

      {/* Hidden file input for native image/document picker */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Instant Manual Add Expense Bottom Sheet Modal */}
      <AddExpenseModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      {/* Receipt OCR Scanner Modal */}
      {receiptData && (
        <ShareReceiptModal
          base64={receiptData.base64}
          mimeType={receiptData.mimeType}
          onClose={() => setReceiptData(null)}
        />
      )}
    </>
  );
}
