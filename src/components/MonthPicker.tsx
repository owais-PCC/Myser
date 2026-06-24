'use client';

import { useState, useRef, useEffect } from 'react';

interface MonthPickerProps {
  value: string;
  onChange: (month: string) => void;
  compact?: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MonthPicker({ value, onChange, compact = false }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => parseInt(value.split('-')[0]));
  const ref = useRef<HTMLDivElement>(null);

  const [selectedYear, selectedMonth] = value.split('-').map(Number);

  const display = new Date(value + '-01T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  useEffect(() => {
    if (open) setViewYear(selectedYear);
  }, [open, selectedYear]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleSelect(monthIndex: number) {
    const m = String(monthIndex + 1).padStart(2, '0');
    onChange(`${viewYear}-${m}`);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: compact ? 'max-content' : '100%', marginLeft: compact ? 'auto' : '0' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: compact ? '#f1f5f9' : 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: compact ? '12px' : '16px',
          padding: compact ? '6px 12px' : '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: compact ? '6px' : '0',
          width: compact ? 'auto' : '100%',
          boxShadow: compact ? 'none' : '0 2px 8px rgba(0,0,0,0.04)',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: compact ? '0.82rem' : '1rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.1px' }}>
          {display}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: compact ? '0.75rem' : '0.85rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>
          ▾
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            left: compact ? 'auto' : 0,
            width: compact ? '260px' : 'auto',
            minWidth: compact ? '260px' : '100%',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '20px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
            zIndex: 100,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {/* Year navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <button
              onClick={() => setViewYear((y) => y - 1)}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                width: '34px',
                height: '34px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ‹
            </button>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {viewYear}
            </span>
            <button
              onClick={() => setViewYear((y) => y + 1)}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                width: '34px',
                height: '34px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ›
            </button>
          </div>

          {/* Month grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {MONTHS.map((name, i) => {
              const isSelected = viewYear === selectedYear && i + 1 === selectedMonth;
              return (
                <button
                  key={name}
                  onClick={() => handleSelect(i)}
                  style={{
                    padding: '12px 0',
                    borderRadius: '12px',
                    border: 'none',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    color: isSelected ? 'white' : 'var(--text-primary)',
                    fontWeight: isSelected ? 700 : 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--bg-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
