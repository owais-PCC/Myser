'use client';

import { useState, useEffect } from 'react';
import { addDocument, addTransaction, addCategory, getCategories, saveMerchantMemory, updateDocumentFileName, updateDocumentStoragePath } from '@/lib/db';
import { analyzeReceipt } from '@/lib/ocr-pipeline';
import { backupReceiptToR2 } from '@/lib/receipt-storage';
import { groupItems, scanReceiptItemized, fetchAvailableProviders, ReceiptLineItem, LlmProvider, ProviderOption, ItemizedScanQuotaError } from '@/lib/itemized-scan';
import ItemizedGroupsEditor from '@/components/ItemizedGroupsEditor';
import ProUpgradeModal from '@/components/ProUpgradeModal';
import { useCurrency } from '@/context/CurrencyContext';
import { auth } from '@/lib/firebase';

interface ShareReceiptModalProps {
  base64: string;
  mimeType: string;
  onClose: () => void;
}

interface Category { id: number; name: string; color: string; icon: string; }

type Phase = 'analyzing' | 'review';
type SplitStatus = 'idle' | 'loading' | 'error';

// Colours handed to categories the AI proposes, so a newly created one
// doesn't arrive colourless or identical to its neighbours in charts.
// Same flat palette family the built-in categories use.
const NEW_CATEGORY_COLORS = ['#EE5A24', '#009432', '#0652DD', '#9980FA', '#833471', '#006266'];

export default function ShareReceiptModal({ base64, mimeType, onClose }: ShareReceiptModalProps) {
  const { fmt } = useCurrency();
  const [phase, setPhase] = useState<Phase>('analyzing');
  const [categories, setCategories] = useState<Category[]>([]);
  // The receipt image row. Created up-front so the image is preserved in
  // the Receipts tab even if the user backs out without logging an expense
  // — but NO transaction/pending row exists until Save is pressed.
  const [docId, setDocId] = useState<number | null>(null);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState(0);
  const [categoryId, setCategoryId] = useState(0);
  const [date, setDate] = useState('');
  const [taxAmount, setTaxAmount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Itemized-split state (MYS-9). Explicit and user-triggered: the user
  // picks a model and taps "Split with AI". Any failure sets splitStatus
  // to 'error' with the real message rather than failing silently.
  const [items, setItems] = useState<ReceiptLineItem[]>([]);
  const [itemizedMode, setItemizedMode] = useState(false);
  // Populated from the backend (see fetchAvailableProviders) rather than a
  // hardcoded list, so the picker only ever offers models that actually
  // have a key configured server-side.
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<LlmProvider>('gemini');
  const [splitStatus, setSplitStatus] = useState<SplitStatus>('idle');
  const [splitError, setSplitError] = useState<string | null>(null);
  // Hitting the free/Pro cap isn't a normal error — surface the upgrade
  // screen directly instead of a red error line the user has to interpret.
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    // Fire-and-forget alongside the OCR run — an empty result just means
    // the AI-split section stays hidden, which is the right degraded state.
    fetchAvailableProviders().then((list) => {
      setProviders(list);
      if (list.length > 0) setSelectedProvider(list[0].id);
    });
  }, []);

  useEffect(() => {
    async function run() {
      const cats = await getCategories();
      setCategories(cats);

      const newDocId = await addDocument({
        type: 'receipt',
        file_name: `shared_receipt_${Date.now()}.jpg`,
        date: new Date().toISOString().slice(0, 10),
        mime_type: mimeType,
        data_base64: base64,
      });
      setDocId(newDocId);

      // Background cross-device backup (Cloudflare R2) — purely additive,
      // never awaited/blocking: the local IndexedDB save above is already
      // the complete, authoritative save. See receipt-storage.ts's header
      // comment for why this can't fail loudly.
      backupReceiptToR2(newDocId, base64, mimeType).then((key) => {
        if (key) updateDocumentStoragePath(newDocId, key);
      });

      const today = new Date().toISOString().slice(0, 10);
      try {
        const result = await analyzeReceipt(base64);
        setMerchant(result.merchant);
        setAmount(result.amount);
        setCategoryId(result.categoryId);
        setDate(result.date);
      } catch {
        setMerchant('Unknown');
        setAmount(0);
        setCategoryId(cats[0]?.id || 1);
        setDate(today);
      }
      setPhase('review');
    }
    run();
  }, [base64, mimeType]);

  const thumbUrl = `data:${mimeType};base64,${base64.slice(0, 50000)}`;

  function reassignItem(itemIndex: number, newCategoryName: string) {
    setItems((prev) => {
      const next = [...prev];
      next[itemIndex] = { ...next[itemIndex], category: newCategoryName };
      return next;
    });
  }

  function dropItem(itemIndex: number) {
    setItems((prev) => prev.filter((_, i) => i !== itemIndex));
  }

  async function handleSplitWithAi() {
    setSplitStatus('loading');
    setSplitError(null);
    try {
      const result = await scanReceiptItemized(base64, mimeType, selectedProvider);
      if (result.items.length === 0) {
        setSplitStatus('error');
        setSplitError('The model didn\'t find any line items on this receipt.');
        return;
      }
      setItems(result.items);
      setTaxAmount(result.tax_amount ?? null);
      setItemizedMode(true);
      setSplitStatus('idle');
    } catch (err) {
      if (err instanceof ItemizedScanQuotaError && err.reason !== 'not-signed-in') {
        // Out of free/Pro scans — show the upgrade screen directly rather
        // than an error the user has to figure out what to do with.
        // 'not-signed-in' still falls through to the plain error message
        // below since "upgrade to Pro" isn't the fix for that case.
        setSplitStatus('idle');
        setShowUpgradeModal(true);
        return;
      }
      setSplitStatus('error');
      setSplitError(err instanceof Error ? err.message : 'Split failed for an unknown reason.');
    }
  }

  async function handleSaveItemized() {
    if (docId === null || saving) return;
    setSaving(true);
    try {
      const groups = groupItems(items, categories);
      if (groups.length === 0) {
        onClose();
        return;
      }
      const largestGroup = groups.reduce((a, b) => (b.amount > a.amount ? b : a), groups[0]);
      let newCategoryColorIndex = 0;

      for (const group of groups) {
        // A null id means the AI proposed a category the user doesn't have
        // (badged NEW in the review sheet). Create it now — only on save,
        // so backing out of the sheet never leaves stray categories behind.
        let resolvedCategoryId = group.category_id;
        if (resolvedCategoryId === null) {
          resolvedCategoryId = await addCategory({
            name: group.category_name,
            color: NEW_CATEGORY_COLORS[newCategoryColorIndex++ % NEW_CATEGORY_COLORS.length],
            icon: '🏷️',
            type: 'expense',
          });
        }

        await addTransaction({
          category_id: resolvedCategoryId,
          amount: group.amount,
          date,
          note: merchant,
          document_id: docId,
          line_items: JSON.stringify(group.items),
          // No per-item tax breakdown exists on the receipt, so the single
          // captured tax figure goes on the largest group rather than being
          // arbitrarily split or silently dropped.
          tax_amount: group === largestGroup ? (taxAmount ?? undefined) : undefined,
        });
        await saveMerchantMemory(merchant, resolvedCategoryId);
      }
      await updateDocumentFileName(docId, `${merchant} ${date}`);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSingle() {
    if (docId === null || saving) return;
    if (amount <= 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await addTransaction({
        category_id: categoryId,
        amount,
        date,
        note: merchant,
        document_id: docId,
      });
      await saveMerchantMemory(merchant, categoryId);
      await updateDocumentFileName(docId, `${merchant} ${date}`);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const groups = itemizedMode ? groupItems(items, categories) : [];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, animation: 'fadeInOverlay 0.2s ease' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401, animation: 'slideUp 0.3s ease' }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          background: 'var(--bg-primary)', borderRadius: '24px 24px 0 0', maxWidth: '430px',
          margin: '0 auto', padding: '24px 20px 32px', maxHeight: '85vh', overflowY: 'auto',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Log Receipt
            </h3>
            <button onClick={onClose} style={{ background: 'var(--bg-elevated)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1rem' }}>
              ✕
            </button>
          </div>

          {/* Thumbnail */}
          <div style={{ width: '100%', height: '160px', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px', background: 'var(--bg-elevated)' }}>
            <img src={thumbUrl} alt="Receipt" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          {phase === 'analyzing' ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
              <div style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.95rem' }}>
                Reading receipt...
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px', lineHeight: 1.5 }}>
                Extracting merchant, amount and category.
                <br />First scan may take up to a minute.
              </div>
            </div>
          ) : itemizedMode && items.length > 0 ? (
            <>
              {/* Itemized review (MYS-9) */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{merchant}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {`Split into ${groups.length} categor${groups.length === 1 ? 'y' : 'ies'} · ${fmt(groups.reduce((s, g) => s + g.amount, 0))}${taxAmount ? ` (incl. ${fmt(taxAmount)} tax)` : ''}`}
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <ItemizedGroupsEditor
                  items={items}
                  categories={categories}
                  fmt={fmt}
                  onReassign={reassignItem}
                  onDrop={dropItem}
                />
              </div>

              <button
                onClick={() => setItemizedMode(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', textDecoration: 'underline', cursor: 'pointer', padding: 0, marginBottom: '14px', display: 'block' }}
              >
                Log as one expense instead
              </button>

              <button
                onClick={handleSaveItemized}
                disabled={saving}
                style={{ width: '100%', background: saving ? 'var(--bg-secondary)' : 'var(--accent)', color: saving ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '0.95rem', fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}
              >
                {saving ? 'Saving…' : `Save ${groups.length} Expense${groups.length === 1 ? '' : 's'}`}
              </button>
            </>
          ) : (
            <>
              {/* Extracted fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Merchant</div>
                  <input className="input-field" value={merchant} onChange={(e) => setMerchant(e.target.value)} style={{ fontSize: '0.9rem', padding: '8px 12px' }} />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Amount</div>
                    <input className="input-field" type="number" value={amount || ''} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} style={{ fontSize: '0.9rem', padding: '8px 12px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Date</div>
                    <input className="input-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ fontSize: '0.9rem', padding: '8px 12px' }} />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Category</div>
                  <select
                    className="input-field"
                    value={categoryId}
                    onChange={(e) => setCategoryId(Number(e.target.value))}
                    style={{ fontSize: '0.9rem', padding: '8px 12px', appearance: 'auto' }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Explicit AI split trigger (MYS-9). Hidden entirely when the
                  backend reports no configured providers — offering this
                  with nothing usable behind it would only produce failures.
                  Deliberately no model picker and no vendor name anywhere
                  in this UI — which AI does the splitting is an
                  implementation detail, not something the user chooses or
                  needs to know. Which provider actually runs is decided
                  server-side (see receipt-scan-api's ACTIVE_PROVIDER); if a
                  second provider is added later for failover, that stays a
                  backend concern too. */}
              {providers.length > 0 && (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: '14px', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Multiple items on this receipt?
                  </div>
                  <button
                    onClick={handleSplitWithAi}
                    disabled={splitStatus === 'loading'}
                    style={{
                      width: '100%', background: splitStatus === 'loading' ? 'var(--bg-secondary)' : 'var(--accent)',
                      color: splitStatus === 'loading' ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: '10px',
                      padding: '10px 12px', fontSize: '0.85rem', fontWeight: 700, cursor: splitStatus === 'loading' ? 'default' : 'pointer',
                    }}
                  >
                    {splitStatus === 'loading' ? 'Splitting…' : '✨ Split with AI'}
                  </button>
                  {splitStatus === 'error' && splitError && (
                    <div style={{ color: 'var(--danger, #dc2626)', fontSize: '0.75rem', marginTop: '8px', lineHeight: 1.4 }}>
                      {splitError}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <button
                onClick={handleSaveSingle}
                disabled={saving}
                style={{ width: '100%', background: saving ? 'var(--bg-secondary)' : 'var(--accent)', color: saving ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '0.95rem', fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}
              >
                {saving ? 'Saving…' : 'Save Expense'}
              </button>
            </>
          )}
        </div>
      </div>

      {showUpgradeModal && (
        <ProUpgradeModal uid={auth.currentUser?.uid ?? null} onClose={() => setShowUpgradeModal(false)} />
      )}
    </>
  );
}
