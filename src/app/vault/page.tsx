'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getDocuments, deleteDocument, getDocumentData, Document } from '@/lib/db';
import DocumentViewer from '@/components/DocumentViewer';
import PageHeader from '@/components/PageHeader';
import MonthPicker from '@/components/MonthPicker';
import { Search, X } from 'lucide-react';

export default function VaultPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [docThumbs, setDocThumbs] = useState<Record<number, string | null>>({});
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const results = await getDocuments('receipt');
      setDocs(results);
      const thumbs: Record<number, string | null> = {};
      for (const doc of results) {
        if (doc.mime_type.startsWith('image/')) {
          try {
            const data = await getDocumentData(doc.id);
            thumbs[doc.id] = data ? `data:${doc.mime_type};base64,${data}` : null;
          } catch {
            thumbs[doc.id] = null;
          }
        }
      }
      setDocThumbs(thumbs);
    } catch (e) {
      console.error('Failed to load docs:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  async function handleDelete(id: number) {
    await deleteDocument(id);
    setConfirmDelete(null);
    await loadDocs();
  }

  const filteredDocs = useMemo(() => {
    return docs.filter((doc) => {
      if (monthFilter && !doc.date.startsWith(monthFilter)) return false;
      if (search.trim() && !doc.file_name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [docs, search, monthFilter]);

  const hasActiveFilters = search.trim().length > 0 || monthFilter !== null;

  return (
    <div className="page-content" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
      <PageHeader title="Receipts" />

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <Search size={17} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search receipts by name..."
          className="input-field"
          style={{ paddingLeft: '40px', fontSize: '0.9rem' }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Clear search"
            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Date filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <div style={{ flex: 1 }}>
          <MonthPicker value={monthFilter || new Date().toISOString().slice(0, 7)} onChange={setMonthFilter} compact />
        </div>
        {monthFilter && (
          <button
            onClick={() => setMonthFilter(null)}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            All dates
          </button>
        )}
      </div>

      {/* Documents */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
          Loading...
        </div>
      ) : filteredDocs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🧾</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 600 }}>
            {hasActiveFilters ? 'No matching receipts' : 'No receipts yet'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px', fontWeight: 500 }}>
            {hasActiveFilters ? 'Try a different search or date' : 'Scan or upload a receipt to see it here'}
          </div>
        </div>
      ) : (
        /* Receipts: responsive grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
          {filteredDocs.map((doc) => {
            const dataUrl = docThumbs[doc.id] || null;
            return (
            <div key={doc.id} className="card" style={{ padding: '0', overflow: 'hidden', position: 'relative' }}>
              <div
                onClick={() => setViewDoc(doc)}
                style={{ cursor: 'pointer' }}
              >
                {doc.mime_type.startsWith('image/') && dataUrl ? (
                  <img
                    src={dataUrl}
                    alt={doc.file_name}
                    style={{ width: '100%', height: '120px', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)', fontSize: '2.5rem' }}>
                    📄
                  </div>
                )}
                <div style={{ padding: '10px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.file_name}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                    {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setConfirmDelete(confirmDelete === doc.id ? null : doc.id)}
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.5)',
                  border: 'none',
                  color: 'white',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
              {confirmDelete === doc.id && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(220, 38, 38, 0.9)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: '20px',
                }}>
                  <div style={{ color: 'white', fontSize: '0.82rem', fontWeight: 700 }}>Delete?</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleDelete(doc.id)} style={{ background: 'white', color: 'var(--danger)', border: 'none', borderRadius: '8px', padding: '6px 14px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                      Yes
                    </button>
                    <button onClick={() => setConfirmDelete(null)} style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 14px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                      No
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
          })}
        </div>
      )}

      {/* Fullscreen viewer */}
      {viewDoc && (
        <DocumentViewer doc={viewDoc} onClose={() => setViewDoc(null)} />
      )}
    </div>
  );
}
