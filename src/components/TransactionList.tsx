'use client';

import { Transaction } from '@/lib/db';
import { useState } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import CategoryIcon from '@/components/CategoryIcon';
import TransactionDetailModal from '@/components/TransactionDetailModal';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete?: (id: number) => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function groupByDate(transactions: Transaction[]) {
  const groups: Record<string, Transaction[]> = {};
  for (const tx of transactions) {
    if (!groups[tx.date]) groups[tx.date] = [];
    groups[tx.date].push(tx);
  }
  return groups;
}

export default function TransactionList({ transactions, onDelete }: TransactionListProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const { fmt } = useCurrency();

  if (transactions.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>No transactions yet</div>
        <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Log your first expense above</div>
      </div>
    );
  }

  const groups = groupByDate(transactions);
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  async function handleDelete(id: number) {
    setDeletingId(id);
    await onDelete?.(id);
    setDeletingId(null);
  }

  return (
    <div>
      {sortedDates.map((date) => {
        const dayTotal = groups[date].reduce((s, t) => s + Number(t.amount), 0);
        return (
          <div key={date} style={{ marginBottom: '4px' }}>
            {/* Date group header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 20px',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                }}
              >
                {formatDate(date)}
              </span>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}
              >
                {fmt(dayTotal)}
              </span>
            </div>

            {/* Transactions */}
            <div className="card" style={{ margin: '0 16px', padding: '0 16px' }}>
              {groups[date].map((tx) => (
                <div
                  key={tx.id}
                  className="tx-item fade-in"
                  style={{ opacity: deletingId === tx.id ? 0.4 : 1, cursor: 'pointer' }}
                  onClick={() => setSelectedTx(tx)}
                >
                  <div
                    className="tx-icon"
                    style={{ background: tx.category_color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <CategoryIcon icon={tx.category_icon} name={tx.category_name} size={20} color={tx.category_color} />
                  </div>
                  <div className="tx-info">
                    <div className="tx-category">{tx.category_name}</div>
                    {tx.note && <div className="tx-note">{tx.note}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div className="tx-amount">-{fmt(Number(tx.amount))}</div>
                      {tx.document_id && (
                        <div style={{ fontSize: '0.6rem', color: 'var(--accent)', fontWeight: 600, marginTop: '2px' }}>
                          🧾 Receipt
                        </div>
                      )}
                    </div>
                    {onDelete && (
                      <button
                        className="delete-btn"
                        onClick={(e) => { e.stopPropagation(); handleDelete(tx.id); }}
                        title="Delete"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {selectedTx && (
        <TransactionDetailModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </div>
  );
}
