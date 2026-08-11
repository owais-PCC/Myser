'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getCategories,
  addCategory,
  addTransaction,
  getSpendingByCategory,
  getMonthlyBudget,
  upsertBudget,
  CategorySpending,
} from '@/lib/db';
import CategoryIcon from '@/components/CategoryIcon';
import DatePickerModal from '@/components/DatePickerModal';
import { Toast, useToast } from '@/components/Toast';
import { useCurrency } from '@/context/CurrencyContext';
import { useAppMode } from '@/context/AppModeContext';
import { useAuth } from '@/context/AuthContext';
import { isSyncEnabled, uploadAllData } from '@/lib/firestore-sync';
import { Calendar, ChevronDown, PencilLine, Settings, Delete, X } from 'lucide-react';

interface Category {
  id: number;
  name: string;
  color: string;
  icon?: string;
}

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddExpenseModal({ isOpen, onClose }: AddExpenseModalProps) {
  const { mode } = useAppMode();
  const { user } = useAuth();
  const { currency, fmt } = useCurrency();
  const { toast, show: showToast, hide: hideToast } = useToast();

  const [entryType, setEntryType] = useState<'expense' | 'income'>('expense');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [autoRepeat, setAutoRepeat] = useState(false);

  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // New category creation states
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🛒');
  const [newCatColor, setNewCatColor] = useState('#047857');
  const [addingCategory, setAddingCategory] = useState(false);

  // Budget reallocation modal states
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState(0);
  const [transferTargetCatId, setTransferTargetCatId] = useState<number | null>(null);
  const [budgetData, setBudgetData] = useState<CategorySpending[]>([]);
  const [pendingSave, setPendingSave] = useState<{ category_id: number; amount: number; date: string; note?: string } | null>(null);

  const monthStr = new Date().toISOString().slice(0, 7);

  const ICON_OPTIONS = [
    '🛒', '⛽', '👗', '💡', '🏥', '🎬', '🤝', '🚗', '🎓', '🍱',
    '🍔', '🍕', '☕', '🍷', '🚌', '✈️', '🏠', '🔧', '💊', '🏋️',
    '📱', '💻', '🎮', '📚', '💼', '🎁', '🎨', '🚀',
  ];
  const COLOR_OPTIONS = ['#047857', '#4ECDC4', '#A29BFE', '#FD79A8', '#55EFC4', '#FDCB6E', '#81ECEC', '#74B9FF', '#FAB1A0', '#E17055', '#00B894', '#6C5CE7'];

  const loadCategories = useCallback(async () => {
    const cats = await getCategories(entryType);
    setCategories(cats);
    setSelectedCategory(cats.length > 0 ? cats[0].id : null);
  }, [entryType]);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen, loadCategories]);

  // Reset entry-type-specific state whenever the modal closes, so the next
  // open starts fresh rather than remembering the last session's toggle.
  useEffect(() => {
    if (!isOpen) {
      setEntryType('expense');
      setIsRecurring(false);
      setAutoRepeat(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleKey(key: string) {
    if (key === 'DEL') {
      setAmount((prev) => prev.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (amount.includes('.')) return;
      setAmount((prev) => prev + '.');
      return;
    }
    if (amount.replace('.', '').length >= 8) return;
    setAmount((prev) => {
      if (prev === '0' && key !== '.') return key;
      return prev + key;
    });
  }

  async function handleSave() {
    if (!amount || parseFloat(amount) <= 0) {
      showToast('Enter an amount', 'error');
      return;
    }
    if (!selectedCategory) {
      showToast('Pick a category', 'error');
      return;
    }

    const expenseAmount = parseFloat(amount);

    if (mode === 'budget') {
      const [catSpending, totalBudget] = await Promise.all([
        getSpendingByCategory(monthStr),
        getMonthlyBudget(monthStr),
      ]);

      if (totalBudget && totalBudget > 0) {
        const targetCat = catSpending.find((c) => c.id === selectedCategory);
        const remaining = targetCat ? targetCat.budget - targetCat.spent : 0;

        if (remaining < expenseAmount) {
          const fundedCats = catSpending.filter(
            (c) => c.id !== selectedCategory && c.budget - c.spent > 0
          );

          if (fundedCats.length > 0) {
            setBudgetData(catSpending);
            setTransferAmount(expenseAmount);
            setTransferTargetCatId(selectedCategory);
            setPendingSave({
              category_id: selectedCategory,
              amount: expenseAmount,
              date,
              note: note.trim() || undefined,
            });
            setShowTransferModal(true);
            return;
          }
        }
      }
    }

    await saveExpense(selectedCategory, expenseAmount);
  }

  async function saveExpense(categoryId: number, expenseAmount: number) {
    setSaving(true);
    try {
      await addTransaction({
        category_id: categoryId,
        amount: expenseAmount,
        date,
        note: note.trim() || undefined,
      });
      if (user && isSyncEnabled()) uploadAllData(user.uid).catch(() => {});

      setAmount('');
      setNote('');
      const catName = categories.find((c) => c.id === categoryId)?.name;
      const detailText = `${catName ? catName + ' · ' : ''}${fmt(expenseAmount)}`;
      showToast('Expense Saved', 'success', detailText);

      window.dispatchEvent(new Event('expense-saved'));
      setTimeout(() => {
        onClose();
      }, 300);
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleTransferAndSave(fromCatId: number) {
    if (!pendingSave || !transferTargetCatId) return;

    const fromCat = budgetData.find((c) => c.id === fromCatId);
    const toCat = budgetData.find((c) => c.id === transferTargetCatId);
    if (!fromCat || !toCat) return;

    const needed = transferAmount - Math.max(0, toCat.budget - toCat.spent);
    const available = fromCat.budget - fromCat.spent;
    const moveAmount = Math.min(needed, available);

    await upsertBudget(fromCatId, monthStr, fromCat.budget - moveAmount);
    await upsertBudget(transferTargetCatId, monthStr, toCat.budget + moveAmount);

    setShowTransferModal(false);
    await saveExpense(pendingSave.category_id, pendingSave.amount);
    setPendingSave(null);
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) {
      showToast('Enter a category name', 'error');
      return;
    }
    setAddingCategory(true);
    try {
      await addCategory({ name: newCatName.trim(), color: newCatColor, icon: newCatIcon });
      showToast('Category added!', 'success');
      setShowCategoryModal(false);
      setNewCatName('');
      setNewCatIcon('🛒');
      setNewCatColor('#FF6B6B');
      await loadCategories();
    } catch {
      showToast('Failed to add category', 'error');
    } finally {
      setAddingCategory(false);
    }
  }

  const selectedCat = categories.find((c) => c.id === selectedCategory);

  function formatDateLabel(dateStr: string) {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (dateStr === today) {
      const formatted = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `Today, ${formatted}`;
    }
    if (dateStr === yesterday) {
      const formatted = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `Yesterday, ${formatted}`;
    }
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const keypadRows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', 'DEL'],
  ];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1050 }}>
      {toast && (
        <Toast message={toast.message} type={toast.type} detail={toast.detail} onClose={hideToast} />
      )}

      <div
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '430px',
          borderRadius: '28px 28px 0 0',
          padding: '20px 16px 24px',
          maxHeight: '90vh',
          overflowY: 'auto',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
            {entryType === 'income' ? 'Log Income' : 'Log Expense'}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-elevated)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Expense / Income Toggle */}
        <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: '12px', padding: '4px', marginBottom: '12px' }}>
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setEntryType(t)}
              style={{
                flex: 1,
                padding: '9px 0',
                borderRadius: '8px',
                border: 'none',
                background: entryType === t ? 'var(--bg-card)' : 'transparent',
                color: entryType === t ? (t === 'income' ? 'var(--success)' : 'var(--text-primary)') : 'var(--text-secondary)',
                fontWeight: entryType === t ? 700 : 500,
                fontSize: '0.85rem',
                boxShadow: entryType === t ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {t === 'expense' ? 'Expense' : 'Income'}
            </button>
          ))}
        </div>

        {/* Amount Display Card */}
        <div
          className="card"
          style={{
            padding: '14px 16px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            marginBottom: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
              }}
            >
              {currency.code === 'PKR' || currency.code === 'INR' ? 'Rs' : currency.symbol}
            </span>
            <div
              style={{
                fontSize: '2.8rem',
                fontWeight: 900,
                color: amount ? 'var(--text-primary)' : 'var(--text-muted)',
                letterSpacing: '-1.5px',
                lineHeight: 1,
                minWidth: '50px',
                transition: 'color 0.2s ease',
              }}
            >
              {amount || '0'}
            </div>
          </div>

          {/* Date Picker Pill */}
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => setShowDatePickerModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#f1f5f9',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '5px 12px',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Calendar size={12} color="var(--text-secondary)" />
              <span>{formatDateLabel(date)}</span>
              <ChevronDown size={11} color="var(--text-muted)" />
            </button>
          </div>
        </div>

        {/* Date Picker Modal */}
        <DatePickerModal
          isOpen={showDatePickerModal}
          value={date}
          onChange={setDate}
          onClose={() => setShowDatePickerModal(false)}
        />

        {/* Category Dropdown Picker */}
        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <div
            className="card"
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease',
              border: showCategoryDropdown ? '2px solid var(--accent)' : '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: selectedCat ? selectedCat.color + '18' : 'var(--bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {selectedCat ? (
                  <CategoryIcon icon={selectedCat.icon || '🛒'} name={selectedCat.name} size={18} />
                ) : (
                  <span style={{ fontSize: '1rem' }}>🛒</span>
                )}
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Category
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginTop: '1px' }}>
                  {selectedCat?.name || 'Select Category'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCategoryModal(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: 'var(--accent)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                }}
              >
                <Settings size={14} color="var(--accent)" />
                <span>Manage</span>
              </button>
              <ChevronDown
                size={18}
                color="var(--text-muted)"
                style={{
                  transform: showCategoryDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
              />
            </div>
          </div>

          {/* Category Dropdown Options */}
          {showCategoryDropdown && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                boxShadow: '0 12px 36px rgba(0,0,0,0.12)',
                zIndex: 60,
                maxHeight: '220px',
                overflowY: 'auto',
                padding: '6px',
                animation: 'dropdownSlideDown 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setShowCategoryDropdown(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--accent-light)' : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CategoryIcon icon={cat.icon || '🛒'} name={cat.name} size={16} />
                      </div>
                      <span style={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {cat.name}
                      </span>
                    </div>
                    {isSelected && (
                      <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '0.9rem' }}>✓</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Note Field */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <PencilLine
              size={18}
              style={{
                position: 'absolute',
                left: '16px',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              className="input-field"
              type="text"
              placeholder="Add a note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={100}
              style={{
                paddingLeft: '44px',
                fontSize: '0.9rem',
                borderRadius: '14px',
              }}
            />
          </div>
        </div>

        {/* Keypad */}
        <div className="card" style={{ padding: '10px', marginBottom: '12px' }}>
          <div className="keypad">
            {keypadRows.flat().map((key) => (
              <button
                key={key}
                className={`key-btn${key === 'DEL' ? ' key-delete' : ''}`}
                onClick={() => handleKey(key)}
              >
                {key === 'DEL' ? <Delete size={20} /> : key}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving || !amount || parseFloat(amount) <= 0}
            style={{ width: '100%', padding: '14px', borderRadius: '14px' }}
          >
            {saving ? 'Saving...' : `Save ${amount ? fmt(parseFloat(amount)) : 'Expense'}`}
          </button>
        </div>

        {/* Add Category Sub-Modal */}
        {showCategoryModal && (
          <div className="modal-overlay" onClick={() => setShowCategoryModal(false)} style={{ zIndex: 1200 }}>
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>New Category</span>
                <button
                  onClick={() => setShowCategoryModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="label">Category Name</label>
                  <input
                    className="input-field"
                    placeholder="e.g. Snacks, Gaming, Pets"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">Icon</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '100px', overflowY: 'auto' }}>
                    {ICON_OPTIONS.map((emoji, idx) => (
                      <button
                        key={`${emoji}-${idx}`}
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

                <div>
                  <label className="label">Color</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCatColor(c)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: c,
                          border: newCatColor === c ? '3px solid var(--bg-card)' : 'none',
                          boxShadow: newCatColor === c ? '0 0 0 2px var(--accent)' : 'none',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <button className="btn-primary" onClick={handleAddCategory} disabled={addingCategory}>
                  {addingCategory ? 'Creating...' : 'Create Category'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Budget Reallocation Modal */}
        {showTransferModal && (
          <div className="modal-overlay" onClick={() => setShowTransferModal(false)} style={{ zIndex: 1200 }}>
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--danger)' }}>
                  Category Budget Exceeded
                </span>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  This expense exceeds your allocated category budget. Reallocate funds from another category:
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {budgetData
                  .filter((c) => c.id !== selectedCategory && c.budget - c.spent > 0)
                  .map((cat) => {
                    const available = cat.budget - cat.spent;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleTransferAndSave(cat.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-card)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <CategoryIcon icon={cat.icon || '🛒'} name={cat.name} size={18} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{cat.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Available: {fmt(available)}
                            </div>
                          </div>
                        </div>
                        <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.8rem' }}>
                          Move Funds →
                        </span>
                      </button>
                    );
                  })}
              </div>

              <button
                className="btn-secondary"
                onClick={() => {
                  setShowTransferModal(false);
                  if (pendingSave) {
                    saveExpense(pendingSave.category_id, pendingSave.amount);
                    setPendingSave(null);
                  }
                }}
              >
                Log Anyway (Over Budget)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
