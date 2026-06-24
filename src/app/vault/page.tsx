'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { addDocument, getDocuments, deleteDocument, getDocumentData, Document } from '@/lib/db';
import { processReceipt } from '@/lib/ocr-pipeline';
import DocumentViewer from '@/components/DocumentViewer';
import PageHeader from '@/components/PageHeader';
import { useNotifications } from '@/context/NotificationContext';
import { exportReceiptsAsZip, importReceiptsFromZip, getExportableCount } from '@/lib/receipt-export';
import { backupToDrive, restoreFromDrive, getLastBackupDate } from '@/lib/drive-backup';

type DocType = 'receipt' | 'statement';

export default function VaultPage() {
  const [tab, setTab] = useState<DocType>('receipt');
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [processingDocs, setProcessingDocs] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [docThumbs, setDocThumbs] = useState<Record<number, string | null>>({});
  const importInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setProcessing, refreshCount } = useNotifications();

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const results = await getDocuments(tab);
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
  }, [tab]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  async function handleFileSelect(file: File) {
    const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/png');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const docId = await addDocument({
          type: tab,
          file_name: file.name,
          date: new Date().toISOString().slice(0, 10),
          mime_type: mimeType,
          data_base64: base64,
        });
        await loadDocs();

        if (tab === 'receipt' && mimeType.startsWith('image/')) {
          setProcessingDocs((prev) => new Set(prev).add(docId));
          setProcessing(true);
          processReceipt(docId, base64)
            .then(async () => {
              await refreshCount();
              await loadDocs();
            })
            .catch((e) => console.error('[OCR] Failed:', e))
            .finally(() => {
              setProcessingDocs((prev) => {
                const next = new Set(prev);
                next.delete(docId);
                return next;
              });
              setProcessing(false);
            });
        }
      } catch (e) {
        console.error('[Vault] Save failed:', e);
        alert('Failed to save document: ' + (e instanceof Error ? e.message : 'Unknown error'));
      }
    };
    reader.onerror = () => alert('Failed to read file');
    reader.readAsDataURL(file);
  }

  function handleFilePick() {
    setShowUploadMenu(false);
    fileInputRef.current?.click();
  }

  async function handleCamera() {
    setShowUploadMenu(false);
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        quality: 80,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
      });
      if (photo.base64String) {
        const fileName = `receipt_${Date.now()}.${photo.format}`;
        const mimeType = `image/${photo.format}`;
        const docId = await addDocument({
          type: tab,
          file_name: fileName,
          date: new Date().toISOString().slice(0, 10),
          mime_type: mimeType,
          data_base64: photo.base64String,
        });
        await loadDocs();

        if (tab === 'receipt') {
          setProcessingDocs((prev) => new Set(prev).add(docId));
          setProcessing(true);
          processReceipt(docId, photo.base64String)
            .then(async () => {
              await refreshCount();
              await loadDocs();
            })
            .catch((e) => console.error('[OCR] Failed:', e))
            .finally(() => {
              setProcessingDocs((prev) => { const next = new Set(prev); next.delete(docId); return next; });
              setProcessing(false);
            });
        }
      }
    } catch {
      // user cancelled or camera not available
    }
  }

  async function handleDelete(id: number) {
    await deleteDocument(id);
    setConfirmDelete(null);
    await loadDocs();
  }

  const pillBtnStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '14px 16px',
    borderRadius: '14px',
    border: '1.5px solid #e2e8f0',
    background: '#ffffff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#1e293b',
  };

  const pillIconStyle: React.CSSProperties = {
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    background: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.9rem',
    flexShrink: 0,
    filter: 'grayscale(100%) opacity(0.85)',
  };

  const emptyLabel = tab === 'receipt' ? 'No receipts yet' : 'No statements yet';

  return (
    <div className="page-content" style={{ paddingTop: '28px', paddingLeft: '16px', paddingRight: '16px' }}>
      <PageHeader title="My Logs" />

      {/* Tab Switcher */}
      <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: '12px', padding: '4px', marginBottom: '20px' }}>
        {(['receipt', 'statement'] as DocType[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setConfirmDelete(null); }}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: '8px',
              border: 'none',
              background: tab === t ? 'var(--bg-card)' : 'transparent',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: tab === t ? 700 : 500,
              fontSize: '0.88rem',
              boxShadow: tab === t ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {t === 'receipt' ? 'Receipts' : 'Statements'}
          </button>
        ))}
      </div>

      {/* Upload button */}
      <button
        onClick={() => setShowUploadMenu(!showUploadMenu)}
        className="btn-primary"
        style={{ marginBottom: '16px' }}
      >
        + Upload {tab === 'receipt' ? 'Receipt' : 'Statement'}
      </button>

      {/* Upload menu */}
      {showUploadMenu && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <button onClick={handleCamera} style={pillBtnStyle}>
            <span style={pillIconStyle}>📷</span>
            <span>Take Photo</span>
          </button>
          <button onClick={handleFilePick} style={pillBtnStyle}>
            <span style={pillIconStyle}>📁</span>
            <span>Choose File</span>
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          e.target.value = '';
        }}
      />

      {/* Documents */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
          Loading...
        </div>
      ) : docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>{tab === 'receipt' ? '🧾' : '🏦'}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 600 }}>{emptyLabel}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px', fontWeight: 500 }}>
            Tap the button above to upload your first one
          </div>
        </div>
      ) : tab === 'receipt' ? (
        /* Receipts: 2-column grid */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {docs.map((doc) => {
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
                  <div style={{ fontSize: '0.68rem', color: processingDocs.has(doc.id) ? 'var(--accent)' : 'var(--text-muted)', marginTop: '2px', fontWeight: processingDocs.has(doc.id) ? 700 : 500 }}>
                    {processingDocs.has(doc.id) ? 'Analyzing...' : new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
      ) : (
        /* Statements: single column list */
        <div className="card" style={{ padding: '0 16px' }}>
          {docs.map((doc, i) => (
            <div
              key={doc.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 0',
                borderBottom: i === docs.length - 1 ? 'none' : '1px solid var(--border)',
              }}
            >
              <div
                onClick={() => setViewDoc(doc)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer', minWidth: 0 }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>
                  {doc.mime_type.startsWith('image/') ? '🖼️' : '📄'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.file_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                    {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>
              <button
                onClick={() => confirmDelete === doc.id ? handleDelete(doc.id) : setConfirmDelete(doc.id)}
                style={{
                  background: confirmDelete === doc.id ? 'var(--danger)' : 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  color: confirmDelete === doc.id ? 'white' : 'var(--text-muted)',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Backup Section */}
      {docs.length > 0 && (
        <div style={{ marginTop: '24px', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
            Backup
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={async () => {
                setBackingUp(true);
                setBackupMsg('');
                try {
                  const exportable = await getExportableCount();
                  if (exportable === 0) { setBackupMsg('No files stored locally.'); setBackingUp(false); return; }
                  const { success, failed } = await backupToDrive();
                  if (success > 0) setBackupMsg(`${success} files backed up`);
                  else if (failed > 0) setBackupMsg(`Backup failed`);
                  else setBackupMsg('No files to backup');
                } catch (e) { setBackupMsg(e instanceof Error ? e.message : 'Failed'); }
                setBackingUp(false);
              }}
              disabled={backingUp || exporting}
              style={pillBtnStyle}
            >
              <span style={pillIconStyle}>☁️</span>
              <span>{backingUp ? 'Backing up...' : 'Google Drive'}</span>
            </button>
            <button
              onClick={async () => {
                setExporting(true);
                setBackupMsg('');
                try {
                  const exportable = await getExportableCount();
                  if (exportable === 0) { setBackupMsg('No files stored locally.'); setExporting(false); return; }
                  const count = await exportReceiptsAsZip();
                  setBackupMsg(`${count} files exported`);
                } catch (e) { setBackupMsg(e instanceof Error ? e.message : 'Export failed'); }
                setExporting(false);
              }}
              disabled={exporting || backingUp}
              style={pillBtnStyle}
            >
              <span style={pillIconStyle}>📦</span>
              <span>{exporting ? 'Exporting...' : 'Export ZIP'}</span>
            </button>
          </div>
          {backupMsg && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center', marginTop: '10px' }}>
              {backupMsg}
            </div>
          )}
          {getLastBackupDate() && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '6px' }}>
              Last Drive backup: {new Date(getLastBackupDate()!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </div>
          )}
        </div>
      )}

      {/* Restore Section */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
          Restore
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={async () => {
              setRestoring(true);
              setBackupMsg('');
              try {
                const { imported, linked } = await restoreFromDrive();
                setBackupMsg(`Restored ${imported} files, ${linked} links`);
                await loadDocs();
              } catch (e) { setBackupMsg(e instanceof Error ? e.message : 'Restore failed'); }
              setRestoring(false);
            }}
            disabled={restoring || backingUp || exporting}
            style={pillBtnStyle}
          >
            <span style={pillIconStyle}>☁️</span>
            <span>{restoring ? 'Restoring...' : 'From Drive'}</span>
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={restoring || backingUp || exporting}
            style={pillBtnStyle}
          >
            <span style={pillIconStyle}>📥</span>
            <span>Import ZIP</span>
          </button>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            e.target.value = '';
            setRestoring(true);
            setBackupMsg('');
            try {
              const { imported, linked } = await importReceiptsFromZip(file);
              setBackupMsg(`Imported ${imported} files, re-linked ${linked} transactions`);
              await loadDocs();
            } catch (err) {
              setBackupMsg(err instanceof Error ? err.message : 'Import failed');
            }
            setRestoring(false);
          }}
        />
      </div>

      {/* Fullscreen viewer */}
      {viewDoc && (
        <DocumentViewer doc={viewDoc} onClose={() => setViewDoc(null)} />
      )}
    </div>
  );
}
