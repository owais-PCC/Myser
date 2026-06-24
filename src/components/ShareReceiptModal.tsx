'use client';

import { useState, useEffect } from 'react';
import { addDocument, addTransaction, getCategories, getDocumentData, getPendingLogs, deletePendingLog, saveMerchantMemory, updateDocumentFileName } from '@/lib/db';
import { processReceipt } from '@/lib/ocr-pipeline';
import { useCurrency } from '@/context/CurrencyContext';
import { useNotifications } from '@/context/NotificationContext';

interface ShareReceiptModalProps {
  base64: string;
  mimeType: string;
  onClose: () => void;
}

interface Category { id: number; name: string; color: string; icon: string; }

type Phase = 'analyzing' | 'review';

interface ExtractedData {
  merchant: string;
  amount: number;
  categoryId: number;
  date: string;
  docId: number;
}

export default function ShareReceiptModal({ base64, mimeType, onClose }: ShareReceiptModalProps) {
  const { fmt } = useCurrency();
  const { refreshCount } = useNotifications();
  const [phase, setPhase] = useState<Phase>('analyzing');
  const [categories, setCategories] = useState<Category[]>([]);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState(0);
  const [categoryId, setCategoryId] = useState(0);
  const [date, setDate] = useState('');

  useEffect(() => {
    async function run() {
      const cats = await getCategories();
      setCategories(cats);

      const docId = await addDocument({
        type: 'receipt',
        file_name: `shared_receipt_${Date.now()}.jpg`,
        date: new Date().toISOString().slice(0, 10),
        mime_type: mimeType,
        data_base64: base64,
      });

      try {
        await processReceipt(docId, base64);
        await refreshCount();

        const logs = await getPendingLogs();
        const thisLog = logs.find((l) => l.document_id === docId);

        if (thisLog) {
          setExtracted({ merchant: thisLog.merchant, amount: thisLog.amount, categoryId: thisLog.category_id, date: thisLog.date, docId });
          setMerchant(thisLog.merchant);
          setAmount(thisLog.amount);
          setCategoryId(thisLog.category_id);
          setDate(thisLog.date);
        } else {
          setExtracted({ merchant: 'Unknown', amount: 0, categoryId: cats[0]?.id || 1, date: new Date().toISOString().slice(0, 10), docId });
          setMerchant('Unknown');
          setCategoryId(cats[0]?.id || 1);
          setDate(new Date().toISOString().slice(0, 10));
        }
      } catch {
        setExtracted({ merchant: 'Unknown', amount: 0, categoryId: cats[0]?.id || 1, date: new Date().toISOString().slice(0, 10), docId });
        setMerchant('Unknown');
        setCategoryId(cats[0]?.id || 1);
        setDate(new Date().toISOString().slice(0, 10));
      }
      setPhase('review');
    }
    run();
  }, [base64, mimeType, refreshCount]);

  const thumbUrl = `data:${mimeType};base64,${base64.slice(0, 50000)}`;

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
              Shared Receipt
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
                Analyzing receipt...
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px', lineHeight: 1.5 }}>
                Extracting merchant, amount and category.
                <br />First scan may take up to a minute.
              </div>
            </div>
          ) : (
            <>
              {/* Extracted fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
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

              {/* Actions */}
              <button
                onClick={async () => {
                  if (extracted && amount > 0) {
                    await addTransaction({
                      category_id: categoryId,
                      amount: amount,
                      date: date,
                      note: merchant,
                      document_id: extracted.docId,
                    });
                    // Learn from confirmation
                    await saveMerchantMemory(merchant, categoryId);
                    await updateDocumentFileName(extracted.docId, `${merchant} ${date}`);
                    const logs = await getPendingLogs();
                    const thisLog = logs.find((l) => l.document_id === extracted.docId);
                    if (thisLog) await deletePendingLog(thisLog.id);
                    await refreshCount();
                  }
                  onClose();
                }}
                style={{ width: '100%', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Save Expense
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
