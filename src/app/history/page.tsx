'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCategories, getTransactionsByMonth, deleteTransaction, Transaction } from '@/lib/db';
import TransactionList from '@/components/TransactionList';
import { useCurrency } from '@/context/CurrencyContext';
import MonthPicker from '@/components/MonthPicker';
import PageHeader from '@/components/PageHeader';
import CategoryIcon from '@/components/CategoryIcon';
import { useAuth } from '@/context/AuthContext';
import { useAppMode } from '@/context/AppModeContext';
import { Toast, useToast } from '@/components/Toast';
import { generateMonthEndReport } from '@/lib/report-generator';
import { FileDown } from 'lucide-react';

interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
}

export default function HistoryPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | 'All'>('All');
  const { currency, fmt } = useCurrency();
  const { user } = useAuth();
  const { mode } = useAppMode();
  const { toast, show: showToast, hide: hideToast } = useToast();
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  async function handleExportReport() {
    if (transactions.length === 0) {
      showToast('No transactions in this month', 'error');
      return;
    }
    setIsGeneratingReport(true);
    try {
      const filename = await generateMonthEndReport(month, user, currency, mode);
      showToast('Report downloaded', 'success', filename);
    } catch (e) {
      showToast('Failed to generate report', 'error');
      console.error(e);
    } finally {
      setIsGeneratingReport(false);
    }
  }

  const loadData = useCallback(async () => {
    const [txs, cats] = await Promise.all([
      getTransactionsByMonth(month),
      getCategories(),
    ]);
    setTransactions(txs);
    setCategories(cats);
  }, [month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const catParam = params.get('category');
      if (catParam) {
        const catId = Number(catParam);
        if (!isNaN(catId)) {
          setSelectedCat(catId);
        }
      }
    }
  }, []);

  async function handleDelete(id: number) {
    await deleteTransaction(id);
    loadData();
  }

  const filteredTxs = transactions.filter(
    (t) => selectedCat === 'All' || t.category_id === selectedCat
  );
  
  const totalAmount = filteredTxs.reduce((s, t) => s + Number(t.amount), 0);
  const count = filteredTxs.length;

  return (
    <div className="page-content" style={{ paddingTop: '28px' }}>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
      <div style={{ padding: '0 16px' }}>
        <PageHeader title="History" />

        {/* Month Selector & Report Export */}
        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <MonthPicker value={month} onChange={setMonth} />
          </div>
          <button
            onClick={handleExportReport}
            disabled={isGeneratingReport || transactions.length === 0}
            title="Download PDF Report"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: transactions.length === 0 ? 'var(--text-muted)' : 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: transactions.length === 0 || isGeneratingReport ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              opacity: transactions.length === 0 ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (transactions.length > 0 && !isGeneratingReport) {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.background = 'var(--accent-light)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.background = 'var(--bg-secondary)';
            }}
          >
            <FileDown size={20} />
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div style={{ overflowX: 'auto', padding: '0 16px', marginBottom: '16px', display: 'flex', gap: '8px', WebkitOverflowScrolling: 'touch' }} className="hide-scrollbar">
        <button
          onClick={() => setSelectedCat('All')}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: '1px solid',
            borderColor: selectedCat === 'All' ? 'var(--text-primary)' : 'var(--border)',
            background: selectedCat === 'All' ? 'var(--text-primary)' : 'var(--bg-secondary)',
            color: selectedCat === 'All' ? 'var(--bg-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease',
          }}
        >
          All
        </button>
        {categories.map((c) => {
          const isSelected = selectedCat === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '20px',
                border: '1px solid',
                borderColor: isSelected ? c.color : 'var(--border)',
                background: isSelected ? c.color + '15' : 'var(--bg-secondary)',
                color: isSelected ? c.color : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              <CategoryIcon icon={c.icon} name={c.name} size={14} color={isSelected ? '#ffffff' : 'var(--text-secondary)'} />
              <span>{c.name}</span>
            </button>
          );
        })}
      </div>

      {/* Summary Bar */}
      <div 
        style={{ 
          position: 'sticky', 
          top: 0, 
          zIndex: 10,
          background: 'rgba(245, 245, 247, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--border)',
          borderTop: '1px solid var(--border)',
          padding: '12px 24px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {count} {count === 1 ? 'expense' : 'expenses'}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>·</span>
        <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
          {fmt(totalAmount)}
        </span>
      </div>

      {/* Transaction List */}
      <div style={{ paddingBottom: '20px' }}>
        <TransactionList transactions={filteredTxs} onDelete={handleDelete} onUpdate={loadData} />
      </div>
      
      {/* Hide scrollbar styles for horizontal scrolling */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
