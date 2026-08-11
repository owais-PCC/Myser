'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Line,
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
import { useAuth } from '@/context/AuthContext';
import { Toast, useToast } from '@/components/Toast';
import { generateMonthEndReportDoc } from '@/lib/report-generator';
import ReportPreviewModal from '@/components/ReportPreviewModal';
import { jsPDF } from 'jspdf';
import { FileDown } from 'lucide-react';

export default function AnalyticsPage() {
  const { currency, fmt } = useCurrency();
  const { mode } = useAppMode();
  const { user } = useAuth();
  const { toast, show: showToast, hide: hideToast } = useToast();
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportDoc, setReportDoc] = useState<{ doc: jsPDF; month: string } | null>(null);

  async function handleExportReport() {
    const hasTransactions = catData.some((c) => c.spent > 0);
    if (!hasTransactions) {
      showToast('No transactions in this month', 'error');
      return;
    }
    setIsGeneratingReport(true);
    try {
      const doc = await generateMonthEndReportDoc(month, user, currency, mode);
      setReportDoc({ doc, month });
    } catch (e) {
      showToast('Failed to generate report', 'error');
      console.error(e);
    } finally {
      setIsGeneratingReport(false);
    }
  }

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

  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [yearNum, monthNum] = month.split('-').map(Number);
  const totalDaysInMonth = new Date(yearNum, monthNum, 0).getDate();

  let daysElapsed = totalDaysInMonth;
  if (month === currentMonthStr) {
    daysElapsed = Math.max(1, Math.min(new Date().getDate(), totalDaysInMonth));
  } else if (month > currentMonthStr) {
    daysElapsed = 1;
  }

  const avgDaily = totalSpent > 0 ? totalSpent / daysElapsed : 0;
  const avgWeekly = avgDaily * 7;

  const dailyDataWithRolling = dailyData.map((d, index) => {
    const windowStart = Math.max(0, index - 6);
    const windowSlice = dailyData.slice(windowStart, index + 1);
    const sum = windowSlice.reduce((acc, curr) => acc + curr.total, 0);
    const count = windowSlice.length;
    const rollingAvg = Math.round((sum / count) * 100) / 100;
    return {
      ...d,
      rollingAvg,
    };
  });

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

  const hasTransactions = catData.some((c) => c.spent > 0);

  return (
    <div className="page-content" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
      <PageHeader title="Analytics" />

      {/* Month Selector & Report Export */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <MonthPicker value={month} onChange={setMonth} />
        </div>
        <button
          onClick={handleExportReport}
          disabled={isGeneratingReport || !hasTransactions}
          title="Download PDF Report"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: !hasTransactions ? 'var(--text-muted)' : 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: !hasTransactions || isGeneratingReport ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
            opacity: !hasTransactions ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (hasTransactions && !isGeneratingReport) {
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

          {/* Average Pace Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div className="card" style={{ padding: '16px 14px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
                Daily Average
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                {fmt(avgDaily)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                per day
              </div>
            </div>

            <div className="card" style={{ padding: '16px 14px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
                Weekly Average
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.5px' }}>
                {fmt(avgWeekly)}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
                per week
              </div>
            </div>
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
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart accessibilityLayer={false}>
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
                            stroke="none"
                            strokeWidth={0}
                            style={{ outline: 'none' }}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Donut Label */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      pointerEvents: 'none',
                      background: 'rgba(255, 255, 255, 0.92)',
                      backdropFilter: 'blur(6px)',
                      padding: '8px 14px',
                      borderRadius: '16px',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
                      border: '1px solid var(--border)',
                      minWidth: '95px',
                    }}
                  >
                    {activeSlice !== null && pieData[activeSlice] ? (
                      <>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {pieData[activeSlice].name}
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '1px' }}>
                          {fmt(pieData[activeSlice].value)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Total
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '1px' }}>
                          {fmt(totalSpent)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Daily Spending & Rolling Trend */}
          <div className="card" style={{ padding: '20px 16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="section-title" style={{ margin: 0 }}>Daily Spending & Trend</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 600, color: '#6C5CE7' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '3px', background: '#6C5CE7', borderRadius: '2px' }} />
                <span>7-Day Trend</span>
              </div>
            </div>
            {dailyData.every((d) => d.total === 0) ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0', fontSize: '0.9rem' }}>
                No spending this month.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <ComposedChart data={dailyDataWithRolling} margin={{ top: 8, right: 4, left: -20, bottom: 0 }} accessibilityLayer={false}>
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
                    formatter={(value, name) => [
                      fmt(Number(value)),
                      name === 'rollingAvg' ? '7-Day Trend' : 'Spent',
                    ]}
                    labelFormatter={(label) => `Day ${label}`}
                    cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                    {...tooltipStyle}
                  />
                  <Bar dataKey="total" fill="var(--accent)" radius={[4, 4, 0, 0]} opacity={0.7} name="Daily Spent" />
                  <Line
                    type="monotone"
                    dataKey="rollingAvg"
                    stroke="#6C5CE7"
                    strokeWidth={2.5}
                    dot={false}
                    name="7-Day Trend"
                  />
                </ComposedChart>
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
                <BarChart data={monthlyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} accessibilityLayer={false}>
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
                    cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                    {...tooltipStyle}
                  />
                  <Bar dataKey="total" fill="#6C5CE7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}

      {/* Report Preview Modal */}
      <ReportPreviewModal
        isOpen={!!reportDoc}
        doc={reportDoc?.doc || null}
        month={reportDoc?.month || ''}
        onClose={() => setReportDoc(null)}
      />
    </div>
  );
}
