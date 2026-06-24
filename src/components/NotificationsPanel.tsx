'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPendingLogs, deletePendingLog, addTransaction, getCategories, getDocumentData, saveMerchantMemory, updateDocumentFileName, PendingLog } from '@/lib/db';
import { useCurrency } from '@/context/CurrencyContext';
import { useNotifications } from '@/context/NotificationContext';

interface Category { id: number; name: string; color: string; icon: string; }

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationsPanel({ isOpen, onClose }: NotificationsPanelProps) {
  const { fmt } = useCurrency();
  const { refreshCount } = useNotifications();
  const [logs, setLogs] = useState<PendingLog[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingField, setEditingField] = useState<{ id: string; field: string } | null>(null);
  const [editValues, setEditValues] = useState<Record<string, Partial<PendingLog> & { comment?: string }>>({});
  const [thumbs, setThumbs] = useState<Record<number, string | null>>({});

  const loadData = useCallback(async () => {
    const [pending, cats] = await Promise.all([getPendingLogs(), getCategories()]);
    setLogs(pending);
    setCategories(cats);
    const defaults: Record<string, Partial<PendingLog> & { comment?: string }> = {};
    pending.forEach((l) => { defaults[l.id] = { merchant: l.merchant, amount: l.amount, category_id: l.category_id, date: l.date, comment: '' }; });
    setEditValues(defaults);
    // Load thumbs
    const t: Record<number, string | null> = {};
    for (const l of pending) {
      t[l.document_id] = await getDocumentData(l.document_id);
    }
    setThumbs(t);
  }, []);

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, loadData]);

  function getEditVal(id: string) {
    return editValues[id] || {};
  }

  async function handleConfirm(log: PendingLog) {
    const vals = getEditVal(log.id);
    const finalMerchant = vals.merchant || log.merchant;
    const finalCategoryId = vals.category_id || log.category_id;

    await addTransaction({
      category_id: finalCategoryId,
      amount: vals.amount || log.amount,
      date: vals.date || log.date,
      note: finalMerchant,
      document_id: log.document_id,
      comment: vals.comment || undefined,
    });

    // Learn from this confirmation (or correction)
    await saveMerchantMemory(finalMerchant, finalCategoryId);

    // Update receipt name to match merchant
    if (log.document_id) {
      await updateDocumentFileName(log.document_id, `${finalMerchant} ${vals.date || log.date}`);
    }

    await deletePendingLog(log.id);
    await refreshCount();
    await loadData();
  }

  async function handleDiscard(id: string) {
    await deletePendingLog(id);
    await refreshCount();
    await loadData();
  }

  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, animation: 'fadeInOverlay 0.2s ease' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '320px', maxWidth: '90vw',
        background: 'var(--bg-primary)', zIndex: 301, display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s ease', boxShadow: '-8px 0 30px rgba(0,0,0,0.1)',
      }}>
        {/* Header */}
        <div style={{ padding: '48px 20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Pending Reviews ({logs.length})
          </h2>
          <button onClick={onClose} style={{ background: 'var(--bg-elevated)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1rem' }}>
            ✕
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No pending reviews
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {logs.map((log) => {
                const vals = getEditVal(log.id);
                const cat = categories.find((c) => c.id === (vals.category_id || log.category_id));
                const thumbData = thumbs[log.document_id] || null;

                return (
                  <div key={log.id} className="card" style={{ padding: '14px' }}>
                    {/* Thumbnail + Merchant */}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-elevated)' }}>
                        {thumbData ? (
                          <img src={`data:image/jpeg;base64,${thumbData}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>🧾</div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {editingField?.id === log.id && editingField.field === 'merchant' ? (
                          <input
                            autoFocus
                            className="input-field"
                            value={vals.merchant || ''}
                            onChange={(e) => setEditValues((p) => ({ ...p, [log.id]: { ...p[log.id], merchant: e.target.value } }))}
                            onBlur={() => setEditingField(null)}
                            style={{ fontSize: '0.88rem', padding: '6px 8px' }}
                          />
                        ) : (
                          <div
                            onClick={() => setEditingField({ id: log.id, field: 'merchant' })}
                            style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', cursor: 'pointer' }}
                          >
                            {vals.merchant || 'Unknown'}
                          </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {cat?.icon} {cat?.name || 'Other'}
                        </div>
                      </div>
                    </div>

                    {/* Amount + Date + Category */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Amount</div>
                        {editingField?.id === log.id && editingField.field === 'amount' ? (
                          <input
                            autoFocus
                            type="number"
                            className="input-field"
                            value={vals.amount || ''}
                            onChange={(e) => setEditValues((p) => ({ ...p, [log.id]: { ...p[log.id], amount: parseFloat(e.target.value) || 0 } }))}
                            onBlur={() => setEditingField(null)}
                            style={{ fontSize: '0.85rem', padding: '6px 8px' }}
                          />
                        ) : (
                          <div
                            onClick={() => setEditingField({ id: log.id, field: 'amount' })}
                            style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', cursor: 'pointer' }}
                          >
                            {fmt(vals.amount || 0)}
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Date</div>
                        <input
                          type="date"
                          value={vals.date || ''}
                          onChange={(e) => setEditValues((p) => ({ ...p, [log.id]: { ...p[log.id], date: e.target.value } }))}
                          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '5px 8px', fontSize: '0.8rem', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', width: '100%', outline: 'none' }}
                        />
                      </div>
                    </div>

                    {/* Category */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Category</div>
                      <select
                        value={vals.category_id || log.category_id}
                        onChange={(e) => setEditValues((p) => ({ ...p, [log.id]: { ...p[log.id], category_id: Number(e.target.value) } }))}
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 8px', fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', width: '100%', outline: 'none' }}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Comment */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Comment</div>
                      <input
                        className="input-field"
                        type="text"
                        placeholder="Add a note (optional)"
                        value={vals.comment || ''}
                        onChange={(e) => setEditValues((p) => ({ ...p, [log.id]: { ...p[log.id], comment: e.target.value } }))}
                        style={{ fontSize: '0.85rem', padding: '6px 8px' }}
                      />
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleConfirm(log)}
                        style={{ flex: 1, background: 'var(--success)', color: 'white', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        ✓ Confirm
                      </button>
                      <button
                        onClick={() => handleDiscard(log.id)}
                        style={{ flex: 1, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
