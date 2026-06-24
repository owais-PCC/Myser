'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCategories, getTransactionsByMonth, deleteTransaction, Transaction } from '@/lib/db';
import TransactionList from '@/components/TransactionList';
import { useCurrency } from '@/context/CurrencyContext';
import MonthPicker from '@/components/MonthPicker';
import PageHeader from '@/components/PageHeader';
import CategoryIcon from '@/components/CategoryIcon';

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
  const { fmt } = useCurrency();

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
      <div style={{ padding: '0 16px' }}>
        <PageHeader title="History" />

        {/* Month Selector */}
        <div style={{ marginBottom: '16px' }}>
          <MonthPicker value={month} onChange={setMonth} />
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
              <CategoryIcon icon={c.icon} name={c.name} size={14} color={isSelected ? c.color : 'var(--text-secondary)'} />
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
        <TransactionList transactions={filteredTxs} onDelete={handleDelete} />
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
