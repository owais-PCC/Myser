'use client';

import { useState, useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error';
  detail?: string;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = 'success', detail, duration = 2000, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, type === 'success' ? 1400 : duration);
    return () => clearTimeout(t);
  }, [duration, type, onClose]);

  if (type === 'success') {
    return (
      <div className="success-overlay-backdrop" onClick={onClose}>
        <div className="success-overlay-card" onClick={(e) => e.stopPropagation()}>
          <div className="checkmark-wrapper">
            <svg className="checkmark-svg" viewBox="0 0 52 52">
              <circle className="checkmark-circle" cx="26" cy="26" r="23" />
              <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
            </svg>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: detail ? '6px' : '0' }}>
            {message}
          </div>
          {detail && (
            <div
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--accent)',
                background: 'var(--accent-light)',
                padding: '4px 12px',
                borderRadius: '20px',
                display: 'inline-block',
                marginTop: '4px',
              }}
            >
              {detail}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="toast"
      style={{
        borderColor: 'rgba(239, 68, 68, 0.2)',
        background: '#fef2f2',
        color: 'var(--danger)',
        top: 'auto',
        bottom: 'calc(var(--nav-height) + 20px)',
      }}
    >
      ⚠️ {message}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; detail?: string } | null>(null);

  const show = (message: string, type: 'success' | 'error' = 'success', detail?: string) => {
    setToast({ message, type, detail });
  };

  const hide = () => setToast(null);

  return { toast, show, hide };
}
