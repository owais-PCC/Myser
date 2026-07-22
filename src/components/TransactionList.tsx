'use client';

import { Transaction, deleteTransaction, updateTransaction, getCategories } from '@/lib/db';
import { useState, useEffect, useRef } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import CategoryIcon from '@/components/CategoryIcon';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import { MoreVertical, X, Calendar, PencilLine } from 'lucide-react';

interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
}


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

      {/* Edit Sheet Modal */}
      {showEditSheet && activeOptionsTx && (
        <TransactionEditModal
          transaction={activeOptionsTx}
          onClose={() => {
            setShowEditSheet(false);
            setActiveOptionsTx(null);
          }}
          onSaved={() => {
            setShowEditSheet(false);
            setActiveOptionsTx(null);
            if (onUpdate) onUpdate();
          }}
        />
      )}
    </div>
  );
}

interface TransactionEditModalProps {
  transaction: Transaction;
  onClose: () => void;
  onSaved: () => void;
}

function TransactionEditModal({ transaction, onClose, onSaved }: TransactionEditModalProps) {
  const [amount, setAmount] = useState(() => String(transaction.amount));
  const [categoryId, setCategoryId] = useState(transaction.category_id);
  const [date, setDate] = useState(transaction.date);
  const [note, setNote] = useState(transaction.note || '');
  const [comment, setComment] = useState(transaction.comment || '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const { fmt } = useCurrency();
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  const handleDateClick = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === 'function') {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current.click();
      }
    }
  };

  async function handleSave() {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      await updateTransaction(transaction.id, {
        category_id: categoryId,
        amount: parsedAmount,
        date,
        note: note.trim() || undefined,
        comment: comment.trim() || null,
      });
      onSaved();
    } catch (err) {
      console.error(err);
      alert('Failed to save transaction changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 300 }}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ zIndex: 301 }}>
        <div className="modal-header">
          <span className="modal-title">Edit Transaction</span>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Amount input */}
          <div className="input-group">
            <label className="input-label">Amount</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '14px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Amount
              </span>
              <input
                className="input-field"
                type="number"
                inputMode="decimal"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ paddingLeft: '80px', fontWeight: 600 }}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Date Picker */}
          <div className="input-group">
            <label className="input-label">Date</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleDateClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <Calendar size={16} color="var(--text-secondary)" />
                <span>{date}</span>
              </button>
              <input
                ref={dateInputRef}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  pointerEvents: 'none',
                  width: 0,
                  height: 0,
                }}
              />
            </div>
          </div>

          {/* Category Selector */}
          <div className="input-group">
            <label className="input-label">Category</label>
            <div className="category-grid" style={{ maxHeight: '160px', overflowY: 'auto', padding: '4px' }}>
              {categories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`category-chip${isSelected ? ' selected' : ''}`}
                    onClick={() => setCategoryId(cat.id)}
                    style={{
                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: isSelected ? 'var(--accent-light)' : 'var(--bg-secondary)',
                      color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    <div className="category-icon-wrapper" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      <CategoryIcon icon={cat.icon} name={cat.name} size={14} />
                    </div>
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note Input */}
          <div className="input-group">
            <label className="input-label">Note</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <PencilLine
                size={16}
                style={{
                  position: 'absolute',
                  left: '14px',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                className="input-field"
                type="text"
                placeholder="Add a note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={100}
                style={{ paddingLeft: '40px' }}
              />
            </div>
          </div>

          {/* Comment Input */}
          <div className="input-group">
            <label className="input-label">Comment</label>
            <input
              className="input-field"
              type="text"
              placeholder="Add details/comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '14px',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '14px',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
