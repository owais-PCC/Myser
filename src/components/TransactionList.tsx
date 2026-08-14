'use client';

import { Transaction, deleteTransaction } from '@/lib/db';
import { useState } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import CategoryIcon from '@/components/CategoryIcon';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import AddExpenseModal from '@/components/AddExpenseModal';
import { MoreVertical, X, Repeat } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete?: (id: number) => void;
  onUpdate?: () => void;
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

export default function TransactionList({ transactions, onDelete, onUpdate }: TransactionListProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [activeOptionsTx, setActiveOptionsTx] = useState<Transaction | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
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

  async function performDelete(id: number) {
    setDeletingId(id);
    await deleteTransaction(id);
    if (onDelete) {
      await onDelete(id);
    }
    if (onUpdate) {
      onUpdate();
    }
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
                    <CategoryIcon icon={tx.category_icon} name={tx.category_name} size={20} color="var(--text-primary)" />
                  </div>
                  <div className="tx-info">
                    <div className="tx-category" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span>{tx.category_name}</span>
                      {!!tx.is_recurring && (
                        <span title={tx.auto_repeat ? 'Recurring · auto-repeats' : 'Recurring'} style={{ display: 'inline-flex', color: 'var(--text-muted)' }}>
                          <Repeat size={12} strokeWidth={2.5} />
                        </span>
                      )}
                    </div>
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveOptionsTx(tx);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '6px',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        transition: 'background 0.2s',
                        marginLeft: '4px',
                      }}
                      title="Options"
                    >
                      <MoreVertical size={18} />
                    </button>
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

      {/* Options bottom sheet */}
      {activeOptionsTx && !showDeleteConfirm && !showEditSheet && (
        <div
          className="modal-overlay"
          onClick={() => setActiveOptionsTx(null)}
          style={{ zIndex: 250 }}
        >
          <div
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: '20px 20px 24px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Transaction Options
              </span>
              <button
                className="modal-close"
                onClick={() => setActiveOptionsTx(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => setShowEditSheet(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '14px 16px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>✏️</span>
                <span>Edit Transaction</span>
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '14px 16px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '14px',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: 'var(--danger)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>🗑️</span>
                <span>Delete Transaction</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Warning Confirmation Dialogue */}
      {showDeleteConfirm && activeOptionsTx && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(false)}
          style={{
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '340px',
              padding: '24px 20px',
              background: 'var(--bg-secondary)',
              borderRadius: '20px',
              textAlign: 'center',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⚠️</div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Delete Transaction?
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.4 }}>
              Are you sure you want to delete this expense of <strong>{fmt(Number(activeOptionsTx.amount))}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowDeleteConfirm(false);
                  const idToDelete = activeOptionsTx.id;
                  setActiveOptionsTx(null);
                  await performDelete(idToDelete);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'var(--danger)',
                  color: 'white',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Sheet — same window used for adding a new transaction, so
          every field (including recurring) is editable here too, e.g. to
          mark an older expense as recurring after the fact. */}
      <AddExpenseModal
        isOpen={showEditSheet && !!activeOptionsTx}
        editTransaction={activeOptionsTx}
        onClose={() => {
          setShowEditSheet(false);
          setActiveOptionsTx(null);
        }}
        onSaved={() => {
          if (onUpdate) onUpdate();
        }}
      />
    </div>
  );
}
