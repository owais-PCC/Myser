'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSpendingByCategory, upsertBudget, CategorySpending, getMonthlyBudget, upsertMonthlyBudget } from '@/lib/db';
import { useCurrency } from '@/context/CurrencyContext';
import { useAppMode } from '@/context/AppModeContext';
import MonthPicker from '@/components/MonthPicker';
import PageHeader from '@/components/PageHeader';
import CategoryIcon from '@/components/CategoryIcon';
import { PlusCircle, Pencil, Minus, Plus, CheckCircle2, X } from 'lucide-react';

export default function BudgetPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState<CategorySpending[]>([]);
  const [lumpSumStr, setLumpSumStr] = useState('');
  const [isEditingLumpSum, setIsEditingLumpSum] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocCatId, setAllocCatId] = useState<number | ''>('');
  const [allocAmount, setAllocAmount] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAmounts, setEditAmounts] = useState<Record<number, string>>({});
  const { currency, fmt } = useCurrency();
  const { mode } = useAppMode();

  const d = new Date();
  const currentMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonth = month === currentMonthStr;

  const loadData = useCallback(async () => {
    const [res, lumpSum] = await Promise.all([
      getSpendingByCategory(month),
      getMonthlyBudget(month)
    ]);
    setData(res);
    setLumpSumStr(lumpSum ? lumpSum.toString() : '');
  }, [month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const lumpSumVal = parseFloat(lumpSumStr) || 0;
  const totalAllocated = data.reduce((s, c) => s + c.budget, 0);
  const totalSpent = data.reduce((s, c) => s + c.spent, 0);
  const unallocated = Math.max(0, lumpSumVal - totalAllocated);
  const allocatedCategories = data.filter((c) => c.budget > 0);

  async function handleLumpSumSave() {
    const val = parseFloat(lumpSumStr);
    const amount = isNaN(val) ? 0 : val;
    setLumpSumStr(amount > 0 ? amount.toString() : '');
    await upsertMonthlyBudget(month, amount);
    setIsEditingLumpSum(false);
  }

  function openAllocateModal() {
    setAllocCatId('');
    setAllocAmount('');
    setShowAllocateModal(true);
  }

  async function handleAllocateSave() {
    if (allocCatId === '' || !allocAmount) return;
    const val = parseFloat(allocAmount);
    if (isNaN(val) || val <= 0) return;

    const existingCat = data.find((c) => c.id === allocCatId);
    const currentBudget = existingCat?.budget || 0;
    const newAmount = currentBudget + val;

    if (lumpSumVal > 0 && val > unallocated) return;

    await upsertBudget(allocCatId as number, month, newAmount);
    setShowAllocateModal(false);
    await loadData();
  }

  function openEditModal() {
    const amounts: Record<number, string> = {};
    allocatedCategories.forEach((c) => {
      amounts[c.id] = c.budget.toString();
    });
    setEditAmounts(amounts);
    setShowEditModal(true);
  }

  const editTotal = Object.values(editAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const editRemaining = lumpSumVal - editTotal;
  const editOverBudget = editRemaining < 0;

  async function handleEditSave() {
    if (editOverBudget) return;
    for (const [idStr, amtStr] of Object.entries(editAmounts)) {
      const id = Number(idStr);
      const amt = parseFloat(amtStr) || 0;
      await upsertBudget(id, month, amt);
    }
    setShowEditModal(false);
    await loadData();
  }

  if (mode === 'tracker') {
    return (
      <div className="page-content" style={{ paddingTop: '28px', paddingLeft: '16px', paddingRight: '16px' }}>
        <PageHeader title="Budget" />
        <div className="card" style={{ marginTop: '16px', textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>📊</div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>Tracker Mode Active</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            You&apos;re currently in Tracker Mode.<br />
            Switch to Budget Mode in Settings to enable budgets.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ paddingTop: '28px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'calc(var(--nav-height) + 16px)' }}>
      <PageHeader title="Budget" />

      <div style={{ marginBottom: '16px' }}>
        <MonthPicker value={month} onChange={setMonth} compact={true} />
      </div>

      {/* Total Monthly Budget Card */}
      <div className="card" style={{ padding: '20px 16px', marginBottom: '20px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Remaining to Spend
          </div>
          {!isEditingLumpSum && lumpSumVal > 0 && (
            <button
              onClick={() => setIsEditingLumpSum(true)}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Edit
            </button>
          )}
        </div>

        {isEditingLumpSum ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              type="number"
              value={lumpSumStr}
              onChange={(e) => setLumpSumStr(e.target.value)}
              autoFocus
              placeholder="Enter amount"
              className="input-field"
              style={{ fontSize: '1.2rem', fontWeight: 700, padding: '12px 14px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleLumpSumSave}
                style={{ flex: 1, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditingLumpSum(false);
                  setLumpSumStr(lumpSumVal > 0 ? lumpSumVal.toString() : '');
                }}
                style={{ flex: 1, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : lumpSumVal > 0 ? (
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1.5px', lineHeight: 1 }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-secondary)', marginRight: '6px' }}>Rs</span>
              {(lumpSumVal - totalSpent).toLocaleString()}
            </div>
            
            {/* Allocation spent and total inline */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '12px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent)', fontSize: '1rem', lineHeight: 1 }}>●</span>
                <span>Rs {totalSpent.toLocaleString()} spent</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                <span style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: 1 }}>●</span>
                <span>Total: Rs {lumpSumVal.toLocaleString()}</span>
              </div>
            </div>

            <div className="progress-bar" style={{ height: '4px', borderRadius: '2px', background: 'var(--bg-elevated)' }}>
              <div
                className="progress-fill"
                style={{
                  width: `${lumpSumVal > 0 ? Math.min((totalSpent / lumpSumVal) * 100, 100) : 0}%`,
                  backgroundColor: 'var(--accent)',
                  borderRadius: '2px',
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <button
              onClick={() => setIsEditingLumpSum(true)}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              + Add Total Budget
            </button>
          </div>
        )}
      </div>

      {/* Allocate Buttons */}
      {lumpSumVal > 0 && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <button
            onClick={openAllocateModal}
            disabled={unallocated <= 0}
            style={{
              flex: 1,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              opacity: unallocated <= 0 ? 0.5 : 1,
              boxShadow: '0 4px 10px rgba(4, 120, 87, 0.15)',
            }}
          >
            <PlusCircle size={16} />
            <span>Allocate</span>
          </button>
          {allocatedCategories.length > 0 && (
            <button
              onClick={openEditModal}
              style={{
                flex: 1,
                background: '#e2e8f0',
                color: '#475569',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Pencil size={15} />
              <span>Edit All</span>
            </button>
          )}
        </div>
      )}

      {/* Categories section title */}
      {allocatedCategories.length > 0 && (
        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
          Categories
        </div>
      )}

      {/* Allocated Categories List */}
      {allocatedCategories.length > 0 && (
        <div className="card" style={{ padding: '4px 16px', marginBottom: '20px' }}>
          {allocatedCategories.map((cat, i) => {
            const percent = cat.budget > 0 ? (cat.spent / cat.budget) * 100 : 0;
            const isFullySpent = cat.spent >= cat.budget;
            const remainingInCat = cat.budget - cat.spent;

            return (
              <div
                key={cat.id}
                style={{
                  padding: '14px 0',
                  borderBottom: i === allocatedCategories.length - 1 ? 'none' : '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <div className="category-icon-wrapper" style={{ background: '#f1f5f9', border: 'none', width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0 }}>
                      <CategoryIcon icon={cat.icon} name={cat.name} size={16} color="var(--text-secondary)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{cat.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 500 }}>
                        {isFullySpent ? (
                          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Fully spent</span>
                        ) : (
                          `Rs ${remainingInCat.toLocaleString()} left of Rs ${cat.budget.toLocaleString()}`
                        )}
                      </div>
                      {/* Category Progress Bar */}
                      <div className="progress-bar" style={{ height: '4px', borderRadius: '2px', background: 'var(--bg-elevated)', width: '120px', marginTop: '6px' }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(percent, 100)}%`,
                            backgroundColor: percent >= 100 ? 'var(--accent)' : percent >= 90 ? 'var(--danger)' : percent >= 70 ? 'var(--warning)' : 'var(--accent)',
                            borderRadius: '2px',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      Rs {cat.budget.toLocaleString()}
                    </div>
                    {/* Badge */}
                    <div
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: percent >= 100 ? '#0f172a' : percent > 0 ? '#edfcf2' : '#f1f5f9',
                        color: percent >= 100 ? '#ffffff' : percent > 0 ? '#047857' : '#64748b',
                      }}
                    >
                      {Math.round(percent)}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Overview */}
      {allocatedCategories.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-elevated)',
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid var(--border)',
            marginBottom: '24px',
          }}
        >
          <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
              Budgeted
            </div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '0.95rem' }}>
              Rs {totalAllocated.toLocaleString()}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
              Spent
            </div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '0.95rem' }}>
              Rs {totalSpent.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Allocate Modal */}
      {showAllocateModal && (
        <div className="modal-overlay" onClick={() => setShowAllocateModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Allocate Budget</span>
              <button className="modal-close" onClick={() => setShowAllocateModal(false)}>✕</button>
            </div>

            {/* Unallocated indicator */}
            <div
              style={{
                background: unallocated > 0 ? 'rgba(22, 163, 74, 0.08)' : 'rgba(220, 38, 38, 0.08)',
                border: `1px solid ${unallocated > 0 ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`,
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                Available to allocate
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: unallocated > 0 ? 'var(--success)' : 'var(--danger)' }}>
                {fmt(unallocated)}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 500 }}>
                out of {fmt(lumpSumVal)} total
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Category selector */}
              <div>
                <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Category</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                  {data.map((cat) => {
                    const isSelected = allocCatId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setAllocCatId(cat.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: '12px',
                          border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                          background: isSelected ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div
                          className="tx-icon"
                          style={{
                            background: cat.color + '22',
                            width: '34px',
                            height: '34px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <CategoryIcon icon={cat.icon} name={cat.name} size={16} color={cat.color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{cat.name}</div>
                          {cat.budget > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '1px' }}>
                              {fmt(cat.budget)} allocated
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <div style={{ color: 'var(--accent)', fontSize: '1rem', flexShrink: 0 }}>✓</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="input-label" style={{ marginBottom: '6px', display: 'block' }}>Amount</label>
                <input
                  type="number"
                  value={allocAmount}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (lumpSumVal > 0 && val > unallocated) return;
                    setAllocAmount(e.target.value);
                  }}
                  placeholder={`Max ${fmt(unallocated)}`}
                  className="input-field"
                  style={{ fontSize: '1rem', fontWeight: 600 }}
                />
                {allocAmount && parseFloat(allocAmount) > unallocated && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 600, marginTop: '6px' }}>
                    Exceeds available budget
                  </div>
                )}
              </div>

              <button
                className="btn-primary"
                onClick={handleAllocateSave}
                disabled={allocCatId === '' || !allocAmount || parseFloat(allocAmount) <= 0}
              >
                Allocate {allocAmount ? fmt(parseFloat(allocAmount)) : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Allocation Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-header" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Edit Allocation
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Adjust your monthly spending limits
                </span>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowEditModal(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Live budget status section */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                background: '#ffffff',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    Total Budget
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {fmt(lumpSumVal)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    Remaining
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: editOverBudget ? 'var(--danger)' : '#059669', marginTop: '2px' }}>
                    {editOverBudget ? '-' : ''}{fmt(Math.abs(editRemaining))}
                  </div>
                </div>
              </div>
              
              {/* Progress bar representing allocations */}
              <div className="progress-bar" style={{ height: '5px', borderRadius: '2.5px', background: '#e2e8f0', width: '100%' }}>
                <div
                  className="progress-fill"
                  style={{
                    width: `${lumpSumVal > 0 ? Math.min((editTotal / lumpSumVal) * 100, 100) : 0}%`,
                    backgroundColor: 'var(--accent)',
                    borderRadius: '2.5px',
                  }}
                />
              </div>
            </div>

            {editOverBudget && (
              <div style={{ fontSize: '0.82rem', color: 'var(--danger)', fontWeight: 600, marginBottom: '12px', textAlign: 'center' }}>
                Total exceeds your budget by {fmt(Math.abs(editRemaining))}
              </div>
            )}

            {/* Category rows with sliders & controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
              {allocatedCategories.map((cat) => {
                const currentVal = parseFloat(editAmounts[cat.id]) || 0;
                
                const handleDecrement = () => {
                  const newVal = Math.max(0, currentVal - 50);
                  setEditAmounts((prev) => ({ ...prev, [cat.id]: newVal.toString() }));
                };

                const handleIncrement = () => {
                  const newVal = currentVal + 50;
                  setEditAmounts((prev) => ({ ...prev, [cat.id]: newVal.toString() }));
                };

                const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                  setEditAmounts((prev) => ({ ...prev, [cat.id]: e.target.value }));
                };

                return (
                  <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Upper row: icon, name, controls */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            background: '#f1f5f9',
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <CategoryIcon icon={cat.icon} name={cat.name} size={18} color="var(--text-secondary)" />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cat.name}
                        </span>
                      </div>

                      {/* Controls: - Input + */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        {/* Minus button */}
                        <button
                          onClick={handleDecrement}
                          type="button"
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'white',
                            border: '1px solid var(--border)',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 700,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                        >
                          <Minus size={14} style={{ strokeWidth: 2.5 }} />
                        </button>

                        {/* Styled Input Container */}
                        <div
                          style={{
                            background: '#f8fafc',
                            borderRadius: '12px',
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            border: '1px solid var(--border)',
                            width: '90px',
                            justifyContent: 'center'
                          }}
                        >
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {currency.symbol}
                          </span>
                          <input
                            type="number"
                            value={editAmounts[cat.id] || '0'}
                            onChange={(e) =>
                              setEditAmounts((prev) => ({ ...prev, [cat.id]: e.target.value }))
                            }
                            style={{
                              width: '50px',
                              background: 'transparent',
                              border: 'none',
                              outline: 'none',
                              fontSize: '0.95rem',
                              fontWeight: 800,
                              color: 'var(--text-primary)',
                              textAlign: 'center',
                              padding: 0,
                              margin: 0
                            }}
                          />
                        </div>

                        {/* Plus button */}
                        <button
                          onClick={handleIncrement}
                          type="button"
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'white',
                            border: '1px solid var(--border)',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 700,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                        >
                          <Plus size={14} style={{ strokeWidth: 2.5 }} />
                        </button>
                      </div>
                    </div>

                    {/* Range slider */}
                    <div style={{ padding: '0 4px' }}>
                      <input
                        type="range"
                        min="0"
                        max={lumpSumVal || 1000}
                        step="10"
                        value={currentVal}
                        onChange={handleSliderChange}
                        style={{
                          width: '100%',
                          cursor: 'pointer',
                          accentColor: 'var(--accent)',
                          height: '4px',
                          borderRadius: '2px',
                          background: '#cbd5e1'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer buttons & label */}
            <button
              className="btn-primary"
              onClick={handleEditSave}
              disabled={editOverBudget}
              style={{
                width: '100%',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '24px',
                padding: '14px 24px',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                opacity: editOverBudget ? 0.5 : 1,
                boxShadow: '0 4px 12px var(--accent-glow)',
                transition: 'all 0.15s ease',
                marginBottom: '14px'
              }}
              onMouseEnter={(e) => { if (!editOverBudget) e.currentTarget.style.background = 'var(--accent-hover)'; }}
              onMouseLeave={(e) => { if (!editOverBudget) e.currentTarget.style.background = 'var(--accent)'; }}
            >
              <CheckCircle2 size={16} />
              <span>Save Allocations</span>
            </button>
            
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'center' }}>
              Applied to {(() => {
                const [year, m] = month.split('-');
                const d = new Date(Number(year), Number(m) - 1, 1);
                return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
              })()} Budget
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
