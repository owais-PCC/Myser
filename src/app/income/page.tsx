'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getIncomeByCategory, getTransactionsByMonth, deleteTransaction,
  getCategories, addCategory, Transaction,
} from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import MonthPicker from '@/components/MonthPicker';
import CategoryIcon from '@/components/CategoryIcon';
import { Toast, useToast } from '@/components/Toast';
import { useCurrency } from '@/context/CurrencyContext';
import { Plus, X } from 'lucide-react';

interface IncomeCategory {
  id: number;
  name: string;
  color: string;
  icon: string;
  received: number;
}

export default function IncomePage() {
  const { fmt } = useCurrency();
  const { toast, show: showToast, hide: hideToast } = useToast();

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // New category modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('💼');
  const [addingCategory, setAddingCategory] = useState(false);

  const ICON_OPTIONS = ['💼', '🏪', '💻', '📈', '🎁', '➕', '💰', '🏦', '📦', '🎓', '🏠', '🎨'];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catData, txs] = await Promise.all([
        getIncomeByCategory(month),
        getTransactionsByMonth(month, { type: 'income' }),
      ]);
      setCategories(catData);
      setTransactions(txs);
    } catch (e) {
      console.error('Failed to load income:', e);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => {
    loadData();
    window.addEventListener('income-saved', loadData);
    return () => window.removeEventListener('income-saved', loadData);
  }, [loadData]);

  const totalIncome = categories.reduce((s, c) => s + c.received, 0);

  async function handleDelete(id: number) {
    await deleteTransaction(id);
    setConfirmDelete(null);
    await loadData();
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) {
      showToast('Enter a source name', 'error');
      return;
    }
    setAddingCategory(true);
    try {
      const colorPalette = ['#047857', '#00B894', '#4ECDC4', '#FDCB6E', '#FD79A8', '#74B9FF'];
      const existing = await getCategories('income');
      const color = colorPalette[existing.length % colorPalette.length];
      await addCategory({ name: newCatName.trim(), color, icon: newCatIcon, type: 'income' });
      showToast('Income source added!', 'success');
      setShowCategoryModal(false);
      setNewCatName('');
      setNewCatIcon('💼');
      await loadData();
    } catch {
      showToast('Failed to add source', 'error');
    } finally {
      setAddingCategory(false);
    }
  }

  return (
    <div className="page-content" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
      {toast && <Toast message={toast.message} type={toast.type} detail={toast.detail} onClose={hideToast} />}
      <PageHeader title="Income" />

      {/* Month selector */}
      <div style={{ marginBottom: '16px' }}>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {/* Total Income hero card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #10b981, #047857)',
          color: 'white',
          border: 'none',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 12px 36px rgba(4, 120, 87, 0.3)',
        }}
      >
        <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', opacity: 0.9 }}>
          Total Income This Month
        </div>
        <div style={{ fontSize: '2.6rem', fontWeight: 900, marginTop: '8px', letterSpacing: '-1.5px', lineHeight: 1 }}>
          {fmt(totalIncome)}
        </div>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: '8px', opacity: 0.85 }}>
          {transactions.length} {transactions.length === 1 ? 'entry' : 'entries'} logged
        </div>
      </div>

      {/* Income by source */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Income Sources
        </span>
        <button
          onClick={() => setShowCategoryModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'none', border: 'none', color: 'var(--accent)',
            fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', padding: '4px 8px',
          }}
        >
          <Plus size={14} />
          <span>Add Source</span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0' }}>Loading...</div>
      ) : categories.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: '0.85rem' }}>
          No income sources yet — tap &quot;Add Source&quot; to create one.
        </div>
      ) : (
        <div className="card" style={{ padding: '0 16px', marginBottom: '24px' }}>
          {categories.map((cat, i) => (
            <div
              key={cat.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 0',
                borderBottom: i === categories.length - 1 ? 'none' : '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: cat.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CategoryIcon icon={cat.icon} name={cat.name} size={17} color={cat.color} />
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{cat.name}</span>
              </div>
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: cat.received > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                {fmt(cat.received)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Recent income entries */}
      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
        Recent Entries
      </div>

      {loading ? null : transactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>💰</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>No income logged yet</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
            Use the + button and switch to Income to log one
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '0 16px' }}>
          {transactions.map((tx, i) => (
            <div
              key={tx.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 0',
                borderBottom: i === transactions.length - 1 ? 'none' : '1px solid var(--border)',
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: tx.category_color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CategoryIcon icon={tx.category_icon} name={tx.category_name} size={18} color={tx.category_color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tx.category_name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {new Date(tx.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {tx.comment ? ` · ${tx.comment}` : tx.note ? ` · ${tx.note}` : ''}
                </div>
              </div>
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--success)', flexShrink: 0 }}>
                +{fmt(tx.amount)}
              </span>
              <button
                onClick={() => confirmDelete === tx.id ? handleDelete(tx.id) : setConfirmDelete(tx.id)}
                style={{
                  background: confirmDelete === tx.id ? 'var(--danger)' : 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: confirmDelete === tx.id ? 'white' : 'var(--text-muted)',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add income source modal */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)} style={{ zIndex: 1200 }}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>New Income Source</span>
              <button onClick={() => setShowCategoryModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label">Source Name</label>
                <input
                  className="input-field"
                  placeholder="e.g. Rental Income, Bonus"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Icon</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {ICON_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewCatIcon(emoji)}
                      style={{
                        fontSize: '1.3rem',
                        padding: '6px',
                        borderRadius: '8px',
                        border: newCatIcon === emoji ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: newCatIcon === emoji ? 'var(--accent-light)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <button className="btn-primary" onClick={handleAddCategory} disabled={addingCategory}>
                {addingCategory ? 'Creating...' : 'Create Source'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
