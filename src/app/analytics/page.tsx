'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  getSpendingByCategory,
  getMonthlyTotals,
  getDailySpending,
  getMonthlyBudget,
  CategorySpending,
} from '@/lib/db';
import { useCurrency } from '@/context/CurrencyContext';
import { useAppMode } from '@/context/AppModeContext';
import MonthPicker from '@/components/MonthPicker';
import PageHeader from '@/components/PageHeader';
import CategoryIcon from '@/components/CategoryIcon';

export default function AnalyticsPage() {
  const { fmt } = useCurrency();
  const { mode } = useAppMode();

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [catData, setCatData] = useState<CategorySpending[]>([]);
  const [dailyData, setDailyData] = useState<{ day: number; total: number }[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<{ month: string; label: string; total: number }[]>([]);
  const [lastMonthTotal, setLastMonthTotal] = useState(0);
  const [budget, setBudget] = useState<number | null>(null);
  const [activeSlice, setActiveSlice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  function getPrevMonth(m: string) {
    const [y, mo] = m.split('-').map(Number);
    let newM = mo - 1, newY = y;
    if (newM === 0) { newM = 12; newY--; }
    return `${newY}-${String(newM).padStart(2, '0')}`;
  }

  function getNextMonth(m: string) {
    const [y, mo] = m.split('-').map(Number);
    let newM = mo + 1, newY = y;
    if (newM === 13) { newM = 1; newY++; }
    return `${newY}-${String(newM).padStart(2, '0')}`;
  }

  function getLast6Months(current: string) {
    const months: string[] = [];
    let m = current;
    for (let i = 0; i < 6; i++) {
      months.unshift(m);
      m = getPrevMonth(m);
    }
    return months;
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    const last6 = getLast6Months(month);
    const prev = getPrevMonth(month);

    const [cats, daily, trend, budgetVal] = await Promise.all([
      getSpendingByCategory(month),
      getDailySpending(month),
      getMonthlyTotals(last6),
      getMonthlyBudget(month),
    ]);

    const [prevData] = await getMonthlyTotals([prev]);

    setCatData(cats);
    setDailyData(daily);
    setMonthlyTrend(
      trend.map((t) => ({
        ...t,
        label: new Date(t.month + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short' }),
      }))
    );
    setLastMonthTotal(prevData.total);
    setBudget(budgetVal);
    setActiveSlice(null);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalSpent = catData.reduce((s, c) => s + c.spent, 0);
  const diff = totalSpent - lastMonthTotal;
  const spentCategories = catData.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent);

  const pieData = spentCategories.map((c) => ({
    name: c.name,
    value: c.spent,
    color: c.color,
    icon: c.icon,
    id: c.id,
  }));

  const tooltipStyle = {
    contentStyle: {
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      fontSize: '0.82rem',
      fontWeight: 600,
      color: 'var(--text-primary)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    },
    itemStyle: { color: 'var(--text-primary)' },
  };

  return (
    <div className="page-content" style={{ paddingTop: '28px', paddingLeft: '16px', paddingRight: '16px' }}>
      <PageHeader title="Analytics" />

      {/* Month Selector */}
      <div style={{ marginBottom: '20px' }}>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
          Loading analytics...
        </div>
      ) : (
        <>
          {/* Spending Overview */}
          <div className="card" style={{ padding: '22px 20px', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
              Total Spent
            </div>
            <div style={{ fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-1px', lineHeight: 1, color: 'var(--text-primary)' }}>
              {fmt(totalSpent)}
            </div>

            {/* vs last month */}
            {(lastMonthTotal > 0 || totalSpent > 0) && (
              <div style={{ marginTop: '12px', fontSize: '0.85rem', fontWeight: 600 }}>
                {diff === 0 ? (
                  <span style={{ color: 'var(--text-muted)' }}>Same as last month</span>
                ) : (
                  <span style={{ color: diff > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {diff > 0 ? '↑' : '↓'} {fmt(Math.abs(diff))} {diff > 0 ? 'more' : 'less'} than last month
                  </span>
                )}
              </div>
            )}

            {/* vs budget (budget mode only) */}
            {mode === 'budget' && budget !== null && budget > 0 && (
              <div style={{ marginTop: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                <span style={{ color: totalSpent > budget ? 'var(--danger)' : 'var(--success)' }}>
                  {totalSpent > budget
                    ? `Over budget by ${fmt(totalSpent - budget)}`
                    : `${fmt(budget - totalSpent)} under budget`}
                </span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> of {fmt(budget)}</span>
              </div>
            )}
          </div>

          {/* Category Breakdown */}
          <div className="card" style={{ padding: '20px 16px', marginBottom: '16px' }}>
            <h2 className="section-title" style={{ marginBottom: '16px' }}>Spending by Category</h2>

            {spentCategories.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0', fontSize: '0.9rem' }}>
                No spending this month.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                        dataKey="value"
                        onClick={(_, index) => setActiveSlice(activeSlice === index ? null : index)}
                        style={{ cursor: 'pointer', outline: 'none' }}
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={entry.id}
                            fill={entry.color}
                            opacity={activeSlice === null || activeSlice === index ? 1 : 0.3}
                            stroke={activeSlice === index ? 'var(--text-primary)' : 'none'}
                            strokeWidth={activeSlice === index ? 2 : 0}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => fmt(Number(value))}
                        {...tooltipStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Category list */}
                <div>
                  {spentCategories.map((cat, i) => {
                    const pct = totalSpent > 0 ? ((cat.spent / totalSpent) * 100).toFixed(1) : '0';
                    const isHighlighted = activeSlice !== null && pieData[activeSlice]?.id === cat.id;
                    return (
                      <div
                        key={cat.id}
                        className="tx-item"
                        style={{
                          padding: '14px 0',
                          borderBottom: i === spentCategories.length - 1 ? 'none' : '1px solid var(--border)',
                          opacity: activeSlice !== null && !isHighlighted ? 0.4 : 1,
                          transition: 'opacity 0.2s ease',
                        }}
                      >
                        <div className="tx-icon" style={{ background: cat.color + '22', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CategoryIcon icon={cat.icon} name={cat.name} size={18} color={cat.color} />
                        </div>
                        <div className="tx-info">
                          <div className="tx-category" style={{ fontSize: '0.95rem' }}>{cat.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>{pct}%</div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {fmt(cat.spent)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Daily Spending */}
          <div className="card" style={{ padding: '20px 16px', marginBottom: '16px' }}>
            <h2 className="section-title" style={{ marginBottom: '16px' }}>Daily Spending</h2>
            {dailyData.every((d) => d.total === 0) ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0', fontSize: '0.9rem' }}>
                No spending this month.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border)' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fmt(v)}
                  />
                  <Tooltip
                    formatter={(value) => [fmt(Number(value)), 'Spent']}
                    labelFormatter={(label) => `Day ${label}`}
                    {...tooltipStyle}
                  />
                  <Bar dataKey="total" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Month-over-Month */}
          <div className="card" style={{ padding: '20px 16px', marginBottom: '16px' }}>
            <h2 className="section-title" style={{ marginBottom: '16px' }}>6-Month Trend</h2>
            {monthlyTrend.every((m) => m.total === 0) ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0', fontSize: '0.9rem' }}>
                No spending data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 600 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border)' }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fmt(v)}
                  />
                  <Tooltip
                    formatter={(value) => [fmt(Number(value)), 'Total']}
                    {...tooltipStyle}
                  />
                  <Bar dataKey="total" fill="#6C5CE7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}
