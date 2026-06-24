'use client';

import { useState, useEffect } from 'react';
import { Transaction, getDocumentData, getDocumentById, Document } from '@/lib/db';
import { useCurrency } from '@/context/CurrencyContext';
import DocumentViewer from './DocumentViewer';

interface TransactionDetailModalProps {
  transaction: Transaction;
  onClose: () => void;
}

export default function TransactionDetailModal({ transaction: tx, onClose }: TransactionDetailModalProps) {
  const { fmt } = useCurrency();
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [doc, setDoc] = useState<Document | null>(null);
  const [loadedDoc, setLoadedDoc] = useState(false);

  if (!loadedDoc && tx.document_id) {
    getDocumentById(tx.document_id).then((d) => {
      setDoc(d);
      setLoadedDoc(true);
    });
  }

  const [thumbData, setThumbData] = useState<string | null>(null);

  useEffect(() => {
    if (tx.document_id) {
      getDocumentData(tx.document_id).then(setThumbData);
    }
  }, [tx.document_id]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          zIndex: 200,
          animation: 'fadeInOverlay 0.2s ease',
        }}
      />
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 201,
        animation: 'slideUp 0.3s ease',
      }}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--bg-primary)',
            borderRadius: '24px 24px 0 0',
            maxWidth: '430px',
            margin: '0 auto',
            padding: '24px 20px 32px',
            maxHeight: '80vh',
            overflowY: 'auto',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Transaction Details
            </h3>
            <button
              onClick={onClose}
              style={{ background: 'var(--bg-elevated)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>

          {/* Amount */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--danger)' }}>
              -{fmt(Number(tx.amount))}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 500 }}>
              {new Date(tx.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          {/* Details */}
          <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: tx.category_color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                {tx.category_icon}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{tx.category_name}</div>
                {tx.note && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{tx.note}</div>}
              </div>
            </div>

            {tx.comment && (
              <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Comment</div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 }}>{tx.comment}</div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Created</span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                {new Date(tx.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Linked Receipt */}
          {tx.document_id && (
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                Linked Receipt
              </div>
              <div
                onClick={() => doc && setViewingDoc(doc)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: doc ? 'pointer' : 'default',
                  padding: '10px',
                  borderRadius: '12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-secondary)' }}>
                  {thumbData ? (
                    <img src={`data:image/jpeg;base64,${thumbData}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🧾</div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc?.file_name || 'Receipt'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, marginTop: '2px' }}>
                    Tap to view
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {viewingDoc && <DocumentViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </>
  );
}
