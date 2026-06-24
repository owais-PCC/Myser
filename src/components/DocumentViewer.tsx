'use client';

import { useState, useEffect } from 'react';
import { Document, getDocumentData } from '@/lib/db';

interface DocumentViewerProps {
  doc: Document;
  onClose: () => void;
}

export default function DocumentViewer({ doc, onClose }: DocumentViewerProps) {
  const isImage = doc.mime_type.startsWith('image/');
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocumentData(doc.id).then((data) => {
      setDataUrl(data ? `data:${doc.mime_type};base64,${data}` : null);
      setLoading(false);
    });
  }, [doc.id, doc.mime_type]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.95)',
        zIndex: 400,
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeInOverlay 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', flexShrink: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.file_name}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', fontWeight: 500, marginTop: '2px' }}>
            {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', fontSize: '1.2rem', flexShrink: 0 }}>
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>Loading...</div>
        ) : dataUrl ? (
          isImage ? (
            <img src={dataUrl} alt={doc.file_name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
          ) : (
            <iframe src={dataUrl} title={doc.file_name} style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', background: 'white' }} />
          )
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: '0.9rem' }}>File not available locally</div>
        )}
      </div>
    </div>
  );
}
