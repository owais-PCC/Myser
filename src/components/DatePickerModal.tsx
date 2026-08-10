'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Check } from 'lucide-react';

interface DatePickerModalProps {
  isOpen: boolean;
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  onClose: () => void;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DatePickerModal({ isOpen, value, onChange, onClose }: DatePickerModalProps) {
  const [viewDate, setViewDate] = useState(() => {
    return value ? new Date(value + 'T00:00:00') : new Date();
  });

  useEffect(() => {
    if (isOpen && value) {
      setViewDate(new Date(value + 'T00:00:00'));
    }
  }, [isOpen, value]);

  if (!isOpen) return null;

  const selectedDateStr = value || new Date().toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0 - 11

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // First day of current month (0 = Sun, 1 = Mon, etc.)
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Total days in current month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Days from previous month to fill grid row
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const daysGrid: Array<{ day: number; currentMonth: boolean; dateStr: string }> = [];

  // Previous month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const prevDay = prevMonthTotalDays - i;
    const prevMonthDate = new Date(year, month - 1, prevDay);
    const dateStr = prevMonthDate.toISOString().slice(0, 10);
    daysGrid.push({ day: prevDay, currentMonth: false, dateStr });
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    const dateStr = `${year}-${mStr}-${dStr}`;
    daysGrid.push({ day: d, currentMonth: true, dateStr });
  }

  // Next month padding to complete 35 or 42 cells grid
  const remainingCells = (7 - (daysGrid.length % 7)) % 7;
  for (let n = 1; n <= remainingCells; n++) {
    const nextMonthDate = new Date(year, month + 1, n);
    const dateStr = nextMonthDate.toISOString().slice(0, 10);
    daysGrid.push({ day: n, currentMonth: false, dateStr });
  }

  function handlePrevMonth() {
    setViewDate(new Date(year, month - 1, 1));
  }

  function handleNextMonth() {
    setViewDate(new Date(year, month + 1, 1));
  }

  function handleSelectDate(dateStr: string) {
    onChange(dateStr);
    onClose();
  }

  function setQuickDate(offsetDays: number) {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    const dateStr = d.toISOString().slice(0, 10);
    onChange(dateStr);
    onClose();
  }

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '380px',
          borderRadius: '28px 28px 0 0',
          padding: '24px 20px 28px',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon size={20} color="var(--accent)" />
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Select Date</span>
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

        {/* Quick Select Shortcut Pills */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button
            onClick={() => setQuickDate(0)}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: '12px',
              border: '1px solid',
              borderColor: selectedDateStr === todayStr ? 'var(--accent)' : 'var(--border)',
              background: selectedDateStr === todayStr ? 'var(--accent-light)' : 'var(--bg-secondary)',
              color: selectedDateStr === todayStr ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Today
          </button>
          <button
            onClick={() => setQuickDate(1)}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: '12px',
              border: '1px solid',
              borderColor: selectedDateStr === yesterdayStr ? 'var(--accent)' : 'var(--border)',
              background: selectedDateStr === yesterdayStr ? 'var(--accent-light)' : 'var(--bg-secondary)',
              color: selectedDateStr === yesterdayStr ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Yesterday
          </button>
        </div>

        {/* Calendar Header Navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            padding: '0 4px',
          }}
        >
          <button
            onClick={handlePrevMonth}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <ChevronLeft size={18} />
          </button>

          <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
            {monthLabel}
          </div>

          <button
            onClick={handleNextMonth}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Weekday Columns Header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px', textAlign: 'center' }}>
          {WEEKDAYS.map((w) => (
            <div key={w} style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {w}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '20px' }}>
          {daysGrid.map((item, idx) => {
            const isSelected = item.dateStr === selectedDateStr;
            const isToday = item.dateStr === todayStr;

            return (
              <button
                key={idx}
                onClick={() => handleSelectDate(item.dateStr)}
                style={{
                  aspectRatio: '1',
                  width: '100%',
                  borderRadius: '50%',
                  border: isToday && !isSelected ? '2px solid var(--accent)' : 'none',
                  background: isSelected ? 'var(--accent)' : 'transparent',
                  color: isSelected ? '#ffffff' : item.currentMonth ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: isSelected ? 800 : isToday ? 700 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  opacity: item.currentMonth ? 1 : 0.4,
                  boxShadow: isSelected ? '0 4px 12px var(--accent-glow)' : 'none',
                }}
              >
                {item.day}
              </button>
            );
          })}
        </div>

        {/* Action Button */}
        <button
          className="btn-primary"
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '12px',
          }}
        >
          <Check size={16} />
          <span>Done</span>
        </button>
      </div>
    </div>
  );
}
