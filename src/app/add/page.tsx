'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCategories,
  addCategory,
  addTransaction,
  getTransactions,
  deleteTransaction,
  getUnallocatedBudget,
  getSpendingByCategory,
  getMonthlyBudget,
  upsertBudget,
  Transaction,
  CategorySpending,
} from '@/lib/db';
import TransactionList from '@/components/TransactionList';
import { Toast, useToast } from '@/components/Toast';
import { useCurrency } from '@/context/CurrencyContext';
import { useAppMode } from '@/context/AppModeContext';
import PageHeader from '@/components/PageHeader';
import CategoryIcon from '@/components/CategoryIcon';
import { Calendar, ChevronDown, PencilLine, Bell, Settings, Delete, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isSyncEnabled, uploadAllData } from '@/lib/firestore-sync';

interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
}

export default function LogPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleDateClick = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === 'function') {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current.click();
      }
    }
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    let prefix = '';
    if (d.toDateString() === today.toDateString()) {
      prefix = 'Today, ';
    } else if (d.toDateString() === yesterday.toDateString()) {
      prefix = 'Yesterday, ';
    }

    const formatted = d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return `${prefix}${formatted}`;
  };
  const [loaded, setLoaded] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🛒');
  const [newCatColor, setNewCatColor] = useState('#047857');
  const [addingCategory, setAddingCategory] = useState(false);
  const [unallocated, setUnallocated] = useState(0);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState(0);
  const [transferTargetCatId, setTransferTargetCatId] = useState<number | null>(null);
  const [budgetData, setBudgetData] = useState<CategorySpending[]>([]);
  const [pendingSave, setPendingSave] = useState<{ category_id: number; amount: number; date: string; note?: string } | null>(null);
  const { toast, show: showToast, hide: hideToast } = useToast();
  const { currency, fmt } = useCurrency();
  const { mode } = useAppMode();

  const ICON_OPTIONS = [
    // Food & Drink
    '🍔', '☕', '🍕', '🛒', '🧺', '🎂', '💧', '🍿',
    // Transport
    '🚗', '⛽', '✈️', '🚌', '🚲', '🚘', '🏍️', '🔥', '🌿', '🔧',
    // Lifestyle & Wellness
    '👗', '💇', '💆', '🛁', '🧘', '🏋️', '🐾', '💐',
    // Tech & Entertainment
    '📱', '🖥️', '🎓', '📚', '🎬', '🎮', '📺', '🎵',
    // Finance & Other
    '💼', '💸', '🐷', '🧾', '🎁', '🎟️', '👶', '🚼', '🎨',
    // Misc
    '🤝', '📦', '❤️', '💊', '🎯', '🚀', '🌐',
  ];
  const COLOR_OPTIONS = ['#047857', '#4ECDC4', '#A29BFE', '#FD79A8', '#55EFC4', '#FDCB6E', '#81ECEC', '#74B9FF', '#FAB1A0', '#E17055', '#00B894', '#6C5CE7'];

  const monthStr = new Date().toISOString().slice(0, 7);

  const loadData = useCallback(async () => {
    const [cats, txs, unalloc] = await Promise.all([
      getCategories(),
      getTransactions(30),
      getUnallocatedBudget(monthStr),
    ]);
    setCategories(cats);
    setTransactions(txs);
    setUnallocated(unalloc);
    if (cats.length > 0 && selectedCategory === null) {
      setSelectedCategory(cats[0].id);
    }
    setLoaded(true);
  }, [selectedCategory, monthStr]);

  useEffect(() => {
    loadData();
  }, []);

  // Keypad press
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
    if (amount.replace('.', '').length >= 8) return; // max 8 digits
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
      const [txs, unalloc] = await Promise.all([
        getTransactions(30),
        getUnallocatedBudget(monthStr),
      ]);
      setTransactions(txs);
      setUnallocated(unalloc);
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
      await loadData();
    } catch {
      showToast('Failed to add category', 'error');
    } finally {
      setAddingCategory(false);
    }
  }

  async function handleDelete(id: number) {
    await deleteTransaction(id);
    const txs = await getTransactions(30);
    setTransactions(txs);
  }

  const selectedCat = categories.find((c) => c.id === selectedCategory);

  // We can just format the typed amount visually by checking length
  // but let's keep it simple and just show the symbol next to raw input
  // to avoid confusion with keypad entry
  const displayAmount = amount ? amount : '';

  const keypadRows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', 'DEL'],
  ];

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {toast && (
        <Toast message={toast.message} type={toast.type} detail={toast.detail} onClose={hideToast} />
      )}

      {/* Fixed top section */}
      <div style={{ flexShrink: 0, background: 'var(--bg-primary)', zIndex: 50, paddingTop: 'calc(var(--safe-area-top) + 20px)', paddingLeft: '16px', paddingRight: '16px' }}>
        {/* Unallocated budget banner */}
        {mode === 'budget' && unallocated > 0 && (
          <div
            style={{
              padding: '8px 14px',
              background: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.2)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--danger)' }}>
              {fmt(unallocated)} unallocated — assign it to categories in Budget
            </span>
          </div>
        )}

        {/* Header */}
        <PageHeader title="Log Expense" />

        {/* Amount Display */}
        <div
          className="card"
          style={{
            margin: '8px 16px 0',
            padding: '14px 16px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Currency + Amount */}
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
              {displayAmount || '0'}
            </div>
          </div>

          {/* Date picker pill */}
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={handleDateClick}
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
      </div>

      {/* Scrollable bottom section */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(var(--nav-height) + 16px)' }}>
        {/* Category Dropdown Picker */}
        <div style={{ margin: '8px 16px 0', position: 'relative' }}>
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
                  <CategoryIcon icon={selectedCat.icon} name={selectedCat.name} size={18} />
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

          {/* Dropdown Options Menu */}
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
                maxHeight: '240px',
                overflowY: 'auto',
                padding: '6px',
                animation: 'slideDown 0.2s ease',
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
                        <CategoryIcon icon={cat.icon} name={cat.name} size={16} />
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

        {/* Note */}
        <div style={{ margin: '8px 16px 0' }}>
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
        <div className="card" style={{ margin: '8px 16px 0', padding: '10px' }}>
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
        <div style={{ margin: '8px 16px 0' }}>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving || !amount || parseFloat(amount) <= 0}
          >
            {saving ? 'Saving...' : `Save ${amount ? fmt(parseFloat(amount)) : 'Expense'}`}
          </button>
        </div>

        {/* Recent Transactions */}
        <div style={{ margin: '24px 0 0' }}>
          <div
            className="section-header"
            style={{ padding: '0 20px', marginBottom: '8px' }}
          >
            <span className="section-title">Recent Transactions</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {transactions.length} entries
            </span>
          </div>
          <TransactionList transactions={transactions} onDelete={handleDelete} onUpdate={loadData} />
        </div>
      </div>

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add Category</span>
              <button className="modal-close" onClick={() => setShowCategoryModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="input-label" style={{ marginBottom: '6px', display: 'block' }}>Name</label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="e.g. Groceries"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  maxLength={20}
                  autoFocus
                />
              </div>

              <div>
                <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Icon</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px', width: '100%', boxSizing: 'border-box' }}>
                  {ICON_OPTIONS.map((icon) => {
                    const isSelected = newCatIcon === icon;
                    return (
                      <button
                        key={icon}
                        onClick={() => setNewCatIcon(icon)}
                        style={{
                          width: '100%',
                          aspectRatio: '1',
                          borderRadius: '50%',
                          background: isSelected ? 'var(--accent)' : 'transparent',
                          border: isSelected ? 'none' : '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.1s ease',
                          padding: 0,
                          minWidth: 0,
                        }}
                      >
                        <CategoryIcon
                          icon={icon}
                          size={16}
                          color={isSelected ? '#ffffff' : 'var(--text-primary)'}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    background: 'var(--accent)',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CategoryIcon icon={newCatIcon} name={newCatName} size={20} color="#ffffff" />
                </div>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                  {newCatName || 'Preview'}
                </span>
              </div>

              <button
                className="btn-primary"
                onClick={handleAddCategory}
                disabled={addingCategory || !newCatName.trim()}
              >
                {addingCategory ? 'Adding...' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Budget Modal */}
      {showTransferModal && transferTargetCatId && (
        <div className="modal-overlay" onClick={() => { setShowTransferModal(false); setPendingSave(null); }}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Move Budget</span>
              <button className="modal-close" onClick={() => { setShowTransferModal(false); setPendingSave(null); }}>✕</button>
            </div>

            <div
              style={{
                background: 'rgba(220, 38, 38, 0.08)',
                border: '1px solid rgba(220, 38, 38, 0.2)',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--danger)', lineHeight: 1.5 }}>
                <strong>{categories.find((c) => c.id === transferTargetCatId)?.name}</strong> doesn't have enough budget for {fmt(transferAmount)}.
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 500 }}>
                Tap a category below to move funds from it.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {budgetData
                .filter((c) => c.id !== transferTargetCatId && c.budget - c.spent > 0)
                .map((cat) => {
                  const available = cat.budget - cat.spent;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleTransferAndSave(cat.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px',
                        borderRadius: '14px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                        width: '100%',
                      }}
                    >
                      <div
                        className="tx-icon"
                        style={{ background: cat.color + '22', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >
                        <CategoryIcon icon={cat.icon} name={cat.name} size={18} color="var(--text-primary)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{cat.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                          {fmt(available)} available
                        </div>
                      </div>
                      <div style={{ color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0 }}>
                        Move →
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
