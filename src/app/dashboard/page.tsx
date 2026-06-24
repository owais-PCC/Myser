'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSpendingByCategory, getTransactions, CategorySpending, Transaction } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import { useCurrency } from '@/context/CurrencyContext';
import { useAppMode } from '@/context/AppModeContext';
import CategoryIcon from '@/components/CategoryIcon';
import { Settings } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { fmt } = useCurrency();
  const { mode } = useAppMode();
  const [data, setData] = useState<CategorySpending[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStr = new Date().toISOString().slice(0, 7);
  const displayMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  useEffect(() => {
    async function load() {
      const [spentData, txs] = await Promise.all([
        getSpendingByCategory(monthStr),
        getTransactions(5)
      ]);
      setData(spentData);
      setTransactions(txs);
      setLoading(false);
    }
    load();
  }, [monthStr]);

  const totalBudgeted = data.reduce((s, c) => s + c.budget, 0);
  const totalSpent = data.reduce((s, c) => s + c.spent, 0);
  const remaining = totalBudgeted - totalSpent;
  const isOver = remaining < 0;

  const activeCategories = data.filter((c) => c.budget > 0);

  return (
    <div className="page-content" style={{ paddingTop: '28px', paddingLeft: '16px', paddingRight: '16px' }}>
      {/* Header */}
      <PageHeader title={displayMonth} />

      {mode === 'budget' ? (
        <>
          {/* Guilt-free number */}
          <div
            className="card"
        style={{
          background: isOver ? 'var(--danger)' : 'var(--success)',
          color: 'white',
          border: 'none',
          padding: '24px 24px 20px',
          textAlign: 'left',
          marginBottom: '28px',
          boxShadow: `0 12px 36px ${isOver ? 'rgba(220, 38, 38, 0.35)' : 'rgba(22, 163, 74, 0.35)'}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', opacity: 0.9 }}>
            You can still spend
          </div>
          <button
            onClick={() => router.push('/budget')}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px',
              padding: '6px 12px', cursor: 'pointer', color: 'white',
              fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
              flexShrink: 0,
            }}
          >
            <Settings size={12} color="white" />
            Adjust
          </button>
        </div>
        <div style={{ fontSize: '3.2rem', fontWeight: 900, marginTop: '10px', letterSpacing: '-1.5px', lineHeight: 1 }}>
          {isOver ? '-' : ''}{fmt(Math.abs(remaining))}
        </div>
        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isOver && (
            <span style={{ fontSize: '0.8rem', fontWeight: 700, background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '6px' }}>
              Over budget!
            </span>
          )}
          <span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.8 }}>
            of {fmt(totalBudgeted)} limit
          </span>
        </div>
      </div>

      {/* Category Budget Cards */}
      {activeCategories.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 className="section-title" style={{ marginBottom: '12px' }}>
            Your Budgets
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activeCategories.map((cat) => {
              const percent = (cat.spent / cat.budget) * 100;
              let progressColor = 'var(--success)';
              if (percent >= 90) progressColor = 'var(--danger)';
              else if (percent >= 70) progressColor = 'var(--warning)';

              return (
                <div
                  key={cat.id}
                  className="card"
                  onClick={() => router.push('/budget')}
                  style={{ padding: '18px 16px', cursor: 'pointer', border: '1px solid var(--border)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        className="tx-icon"
                        style={{
                          background: '#f1f5f9',
                          width: '40px',
                          height: '40px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '10px'
                        }}
                      >
                        <CategoryIcon icon={cat.icon} name={cat.name} size={18} color="var(--text-secondary)" />
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{cat.name}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                        {fmt(cat.budget - cat.spent)} <span style={{ fontWeight: 500, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>left</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                        of {fmt(cat.budget)}
                      </div>
                    </div>
                  </div>
                  <div className="progress-bar" style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-elevated)' }}>
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(percent, 100)}%`,
                        backgroundColor: progressColor,
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
        </>
      ) : (
        /* Tracker Mode */
        <div style={{ paddingBottom: '32px' }}>
          {/* Total Spent Card */}
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg, #6558e8, #8b7cf8)',
              color: 'white',
              border: 'none',
              padding: '28px 24px',
              textAlign: 'center',
              marginBottom: '28px',
              boxShadow: '0 12px 36px rgba(101, 88, 232, 0.35)',
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', opacity: 0.9 }}>
              Total Spent This Month
            </div>
            <div style={{ fontSize: '3.2rem', fontWeight: 900, marginTop: '8px', letterSpacing: '-1.5px', lineHeight: 1 }}>
              {fmt(totalSpent)}
            </div>
          </div>

          <h2 className="section-title" style={{ marginBottom: '12px' }}>
            Spending by Category
          </h2>
          <div className="card" style={{ padding: '0 16px' }}>
            {data.filter(c => c.spent > 0).length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                No spending yet this month.
              </div>
            ) : (
              data.filter(c => c.spent > 0)
                  .sort((a, b) => b.spent - a.spent)
                  .map((cat, i, arr) => (
                <div
                  key={cat.id}
                  className="tx-item"
                  style={{
                    padding: '16px 0',
                    borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <div className="tx-icon" style={{ background: '#f1f5f9', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px' }}>
                    <CategoryIcon icon={cat.icon} name={cat.name} size={18} color="var(--text-secondary)" />
                  </div>
                  <div className="tx-info">
                    <div className="tx-category" style={{ fontSize: '0.95rem' }}>{cat.name}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    {fmt(cat.spent)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 className="section-title" style={{ margin: 0 }}>Recent Transactions</h2>
          <Link
            href="/history"
            style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}
          >
            See all
          </Link>
        </div>
        <div className="card" style={{ padding: '0 16px' }}>
          {transactions.length === 0 ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No transactions yet.
            </div>
          ) : (
            transactions.map((tx, i) => (
              <div
                key={tx.id}
                className="tx-item"
                style={{
                  padding: '16px 0',
                  borderBottom: i === transactions.length - 1 ? 'none' : '1px solid var(--border)',
                }}
              >
                <div
                  className="tx-icon"
                  style={{ background: '#f1f5f9', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px' }}
                >
                  <CategoryIcon icon={tx.category_icon} name={tx.category_name} size={20} color="var(--text-secondary)" />
                </div>
                <div className="tx-info">
                  <div className="tx-category" style={{ fontSize: '0.95rem' }}>{tx.category_name}</div>
                  {tx.note && <div className="tx-note" style={{ marginTop: '2px' }}>{tx.note}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="tx-amount" style={{ fontSize: '0.95rem' }}>
                    -{fmt(Number(tx.amount))}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 500 }}>
                    {new Date(tx.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
