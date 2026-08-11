'use client';

import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { saveOrSharePdf } from '@/lib/report-generator';
import { X, Download, Share2, Eye, FileText, Check, FolderDown } from 'lucide-react';
import { useToast } from '@/components/Toast';

interface ReportPreviewModalProps {
  isOpen: boolean;
  doc: jsPDF | null;
  month: string;
  onClose: () => void;
}

export default function ReportPreviewModal({ isOpen, doc, month, onClose }: ReportPreviewModalProps) {
  const { show: showToast } = useToast();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const formattedMonth = month
    ? new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : '';

  const fileName = `myser-report-${month}.pdf`;

  useEffect(() => {
    if (doc) {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);

      return () => {
        URL.revokeObjectURL(url);
        setPdfUrl(null);
      };
    }
  }, [doc]);

  if (!isOpen || !doc) return null;

  const pageCount = doc.getNumberOfPages();

  async function handleSave() {
    if (!doc) return;
    setSaving(true);
    try {
      const res = await saveOrSharePdf(doc, month);
      if (res.success) {
        if (res.method === 'share') {
          showToast('Report shared', 'success');
        } else if (res.method === 'picker') {
          showToast(`Saved to ${res.fileName}`, 'success');
        } else {
          showToast(`Report downloaded: ${res.fileName}`, 'success');
        }
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to save report', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '430px',
          borderRadius: '28px 28px 0 0',
          padding: '20px 16px 24px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="var(--accent)" />
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Report Preview
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {formattedMonth} • {pageCount} {pageCount === 1 ? 'Page' : 'Pages'}
              </div>
            </div>
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

        {/* Live PDF Embedded Preview Window */}
        <div
          style={{
            flex: 1,
            minHeight: '320px',
            maxHeight: '460px',
            background: '#f8fafc',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            overflow: 'hidden',
            marginBottom: '16px',
            position: 'relative',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          {pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0`}
              title="PDF Report Preview"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#ffffff',
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              Loading preview...
            </div>
          )}
        </div>

        {/* File Details Bar */}
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            <FolderDown size={16} color="var(--accent)" />
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {fileName}
            </span>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>
            PDF Statement
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn-secondary"
            onClick={onClose}
            style={{ flex: 1, padding: '12px', borderRadius: '14px' }}
          >
            Close
          </button>

          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2,
              padding: '12px',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <Share2 size={16} />
            <span>{saving ? 'Processing...' : 'Save or Share...'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
