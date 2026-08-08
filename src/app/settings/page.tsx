'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { useAppMode, AppMode } from '@/context/AppModeContext';
import { CURRENCIES, formatCurrency } from '@/lib/currency';
import {
  getCategories,
  deleteCategory,
  reorderCategories,
  addCategory,
  getBudgetsForMonth,
  wipeLocalData,
  getTransactionsByMonth,
  getSpendingByCategory,
  getMonthlyBudget,
} from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import MonthPicker from '@/components/MonthPicker';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import { uploadAllData, deleteAllCloudData } from '@/lib/firestore-sync';
import CategoryIcon from '@/components/CategoryIcon';
import { Toast, useToast } from '@/components/Toast';
import { generateMonthEndReport, generateMonthEndReportDoc, generateAiPrompt } from '@/lib/report-generator';
import {
  Banknote,
  Shapes,
  Settings as SettingsIcon,
  Sparkles,
  Bell,
  Shield,
  BadgeCheck,
  ChevronRight,
  LogOut,
  ArrowLeft,
  Trash2,
  Equal,
  X,
  ListPlus,
  Plus,
  PiggyBank,
  BarChart3,
  FileText,
  Copy,
  FileDown,
  Eye,
  Share2,
} from 'lucide-react';

interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
}

// Custom Switch Toggle Component
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      type="button"
      style={{
        position: 'relative',
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        background: checked ? 'var(--accent)' : '#cbd5e1',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        padding: 0,
        outline: 'none',
        flexShrink: 0
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '3px',
          left: '3px',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: 'white',
          transition: 'transform 0.2s ease',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
        }}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { currency, setCurrency } = useCurrency();
  const { mode, setMode } = useAppMode();
  const { user, signOut } = useAuth();
  const { syncOn, status: syncStatus, enableSync, disableSync } = useSync();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryBudgets, setCategoryBudgets] = useState<Record<number, number>>({});
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearStep, setClearStep] = useState<1 | 2>(1);
  const [clearing, setClearing] = useState(false);

  // Navigation state for sub-panels
  const [activeSubPanel, setActiveSubPanel] = useState<'currency' | 'categories' | 'appMode' | 'report' | null>(null);

  // Report sub-panel state
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reportTxCount, setReportTxCount] = useState(0);
  const [reportTotalSpent, setReportTotalSpent] = useState(0);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [loadingReportStats, setLoadingReportStats] = useState(false);

  // PDF Preview states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [pdfBase64, setPdfBase64] = useState<string>('');
  const [previewTransactions, setPreviewTransactions] = useState<any[]>([]);

  const loadReportStats = useCallback(async (selectedMonth: string) => {
    setLoadingReportStats(true);
    try {
      const [txs, catSpending] = await Promise.all([
        getTransactionsByMonth(selectedMonth),
        getSpendingByCategory(selectedMonth),
      ]);
      setReportTxCount(txs.length);
      setReportTotalSpent(catSpending.reduce((s, c) => s + c.spent, 0));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReportStats(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubPanel === 'report') {
      loadReportStats(reportMonth);
    }
  }, [activeSubPanel, reportMonth, loadReportStats]);

  async function handleGenerateReport() {
    setIsGeneratingReport(true);
    try {
      const filename = await generateMonthEndReport(reportMonth, user, currency, mode);
      showToast('Report downloaded', 'success', filename);
    } catch (error) {
      showToast('Failed to generate report', 'error');
      console.error(error);
    } finally {
      setIsGeneratingReport(false);
    }
  }

  const formattedReportMonth = new Date(`${reportMonth}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  async function handleOpenPreview() {
    setPreviewLoading(true);
    setShowPreviewModal(true);
    try {
      // 1. Fetch transactions to preview inside the mockup
      const txs = await getTransactionsByMonth(reportMonth);
      setPreviewTransactions(txs.slice(0, 3));

      // 2. Compile the PDF doc
      const doc = await generateMonthEndReportDoc(reportMonth, user, currency, mode);
      const blob = doc.output('blob');
      const dataUri = doc.output('datauristring');
      const base64 = dataUri.split(',')[1];

      setPdfBlob(blob);
      setPdfBase64(base64);

      // 3. Set standard web URL if on browser
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) {
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      }
    } catch (error) {
      console.error('Failed to open preview:', error);
      showToast('Failed to open preview', 'error');
      setShowPreviewModal(false);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleShareReport() {
    if (!pdfBase64 && !pdfBlob) return;
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');

        const tempFilename = `myser-report-${reportMonth}.pdf`;
        const writeResult = await Filesystem.writeFile({
          path: tempFilename,
          data: pdfBase64,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'Myser Month End Report',
          text: `Financial statement for ${formattedReportMonth}`,
          files: [writeResult.uri],
        });
      } else {
        if (navigator.share && pdfBlob) {
          const file = new File([pdfBlob], `myser-report-${reportMonth}.pdf`, { type: 'application/pdf' });
          await navigator.share({
            title: 'Myser Month End Report',
            files: [file],
          });
        } else {
          handleDownloadReport();
          showToast('Sharing not supported, downloaded instead', 'success');
        }
      }
    } catch (error) {
      console.error('Share failed:', error);
      showToast('Failed to share report', 'error');
    }
  }

  async function handleDownloadReport() {
    if (!pdfBase64 && !pdfBlob) return;
    try {
      const { Capacitor } = await import('@capacitor/core');
      const filename = `myser-report-${reportMonth}.pdf`;
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        await Filesystem.writeFile({
          path: `Download/Myser/${filename}`,
          data: pdfBase64,
          directory: Directory.ExternalStorage,
          recursive: true,
        });
        showToast('Saved to Download/Myser/', 'success', filename);
      } else {
        const url = URL.createObjectURL(pdfBlob!);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showToast('Report downloaded', 'success', filename);
      }
    } catch (error) {
      console.error('Download failed:', error);
      showToast('Failed to download report', 'error');
    }
  }

  function handleClosePreview() {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl('');
    }
    setPdfBlob(null);
    setPdfBase64('');
    setPreviewTransactions([]);
    setShowPreviewModal(false);
  }

  async function handleCopyAiPrompt() {
    try {
      const txs = await getTransactionsByMonth(reportMonth);
      const catSpending = await getSpendingByCategory(reportMonth);
      const budgetVal = await getMonthlyBudget(reportMonth);
      
      const [yearNum, monthNum] = reportMonth.split('-').map(Number);
      const totalDays = new Date(yearNum, monthNum, 0).getDate();
      const currentMonthStr = new Date().toISOString().slice(0, 7);
      let daysElapsed = totalDays;
      if (reportMonth === currentMonthStr) {
        daysElapsed = Math.max(1, Math.min(new Date().getDate(), totalDays));
      } else if (reportMonth > currentMonthStr) {
        daysElapsed = 1;
      }
      const totalSpent = catSpending.reduce((s, c) => s + c.spent, 0);
      const avgDaily = totalSpent > 0 ? totalSpent / daysElapsed : 0;
      const monthName = new Date(`${reportMonth}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      const promptText = generateAiPrompt(
        monthName,
        currency,
        totalSpent,
        avgDaily,
        mode,
        budgetVal,
        catSpending,
        txs
      );
      
      await navigator.clipboard.writeText(promptText);
      setCopiedPrompt(true);
      showToast('Copied to clipboard!', 'success');
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (err) {
      showToast('Failed to copy prompt', 'error');
      console.error(err);
    }
  }

  // HTML5 drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Modal state for adding category
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🛒');
  const [newCatColor, setNewCatColor] = useState('#047857');
  const [addingCategory, setAddingCategory] = useState(false);

  // App Mode internal settings state
  const [selectedMode, setSelectedMode] = useState<AppMode>('budget');
  const [autoSwitch, setAutoSwitch] = useState(false);
  const [advancedAnalytics, setAdvancedAnalytics] = useState(true);

  const { toast, show: showToast, hide: hideToast } = useToast();

  const currentMonthStr = new Date().toISOString().slice(0, 7);

  const loadCategoriesAndBudgets = useCallback(async () => {
    const cats = await getCategories();
    setCategories(cats);
    const bgts = await getBudgetsForMonth(currentMonthStr);
    const bgtMap: Record<number, number> = {};
    bgts.forEach((b) => {
      bgtMap[b.category_id] = b.amount;
    });
    setCategoryBudgets(bgtMap);
  }, [currentMonthStr]);

  useEffect(() => {
    loadCategoriesAndBudgets();
  }, [loadCategoriesAndBudgets, activeSubPanel]);

  // Synchronize detailed settings when opening App Mode subpanel
  useEffect(() => {
    if (activeSubPanel === 'appMode') {
      setSelectedMode(mode);
      const switchVal = localStorage.getItem('settings_autoswitch') === 'true';
      const analyticsVal = localStorage.getItem('settings_advancedanalytics') !== 'false';
      setAutoSwitch(switchVal);
      setAdvancedAnalytics(analyticsVal);
    }
  }, [activeSubPanel, mode]);

  // Reordering actions
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newOrder = [...categories];
    const draggedItem = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setCategories(newOrder);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    await reorderCategories(categories.map((c) => c.id));
  };

  async function handleDelete(id: number) {
    try {
      await deleteCategory(id);
      setConfirmDelete(null);
      showToast('Category deleted', 'success');
      await loadCategoriesAndBudgets();
    } catch {
      showToast('Failed to delete category', 'error');
    }
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) {
      showToast('Enter a category name', 'error');
      return;
    }
    setAddingCategory(true);
    try {
      await addCategory({ name: newCatName.trim(), color: newCatColor, icon: newCatIcon });
      showToast('Category added!', 'success');
      setShowAddModal(false);
      setNewCatName('');
      setNewCatIcon('🛒');
      setNewCatColor('#047857');
      await loadCategoriesAndBudgets();
    } catch {
      showToast('Failed to add category', 'error');
    } finally {
      setAddingCategory(false);
    }
  }

  async function handleSavePreference() {
    setMode(selectedMode);
    localStorage.setItem('settings_autoswitch', String(autoSwitch));
    localStorage.setItem('settings_advancedanalytics', String(advancedAnalytics));
    showToast('Preferences saved!', 'success');
    setTimeout(() => {
      setActiveSubPanel(null);
    }, 800);
  }

  const ICON_OPTIONS = [
    // Food & Drink
    '🍔', '☕', '🍕', '🛒', '🧺', '🍽️', '🎂', '💧',
    // Transport
    '🚗', '⛽', '✈️', '🚌', '🚲', '🔥', '🌿', '🔧',
    // Lifestyle & Wellness
    '👗', '💇', '💆', '🛁', '🧘', '🏋️', '🐾', '💐',
    // Tech & Entertainment
    '📱', '🖥️', '🎓', '📚', '🎬', '🎮', '📺', '🎵',
    // Finance & Other
    '💼', '💸', '🐷', '🧾', '🎁', '🎟️', '👶', '🎨',
    // Misc
    '🤝', '📦', '❤️', '💊', '🎯', '🚀', '🎟️', '🌐',
  ];

  // Composite AppMode gear-sparkles icon
  const AppModeIcon = () => (
    <div style={{ position: 'relative', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <SettingsIcon size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '-1px', bottom: '-1px' }} />
      <Sparkles size={10} color="var(--text-secondary)" style={{ position: 'absolute', right: '-2px', top: '-2px' }} />
    </div>
  );

  // --- SUB-PANEL: Currency Selector ---
  if (activeSubPanel === 'currency') {
    return (
      <div className="page-content" style={{ paddingTop: '28px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'calc(var(--nav-height) + 16px)' }}>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={hideToast} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button
            onClick={() => setActiveSubPanel(null)}
            style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex', color: 'var(--accent)' }}
          >
            <ArrowLeft size={24} style={{ strokeWidth: 2.2 }} />
          </button>
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.45rem', color: 'var(--text-primary)', fontWeight: 800 }}>Currency</h1>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {CURRENCIES.map((c) => {
              const isSelected = c.code === currency.code;
              return (
                <div
                  key={c.code}
                  onClick={() => {
                    setCurrency(c.code);
                    setActiveSubPanel(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '14px',
                    background: isSelected ? 'var(--accent-light)' : 'var(--bg-secondary)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.5rem' }}>{c.flag}</span>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                        {c.label} ({c.code})
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 500 }}>
                        Example: {c.symbol}1,234.56
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div style={{ color: 'var(--accent)', fontSize: '1rem', fontWeight: 700 }}>✓</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // --- SUB-PANEL: App Mode Selector ---
  if (activeSubPanel === 'appMode') {
    return (
      <div className="page-content" style={{ paddingTop: '28px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'calc(var(--nav-height) + 24px)' }}>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={hideToast} />
        )}
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <button
            onClick={() => setActiveSubPanel(null)}
            style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex', color: 'var(--accent)' }}
          >
            <ArrowLeft size={24} style={{ strokeWidth: 2.2 }} />
          </button>
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-primary)', fontWeight: 800 }}>App Mode</h1>
        </div>

        {/* Subtitle description */}
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '24px', paddingLeft: '4px', lineHeight: 1.4 }}>
          Choose how you want to manage your finances. You can switch this at any time.
        </div>

        {/* Cards Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          
          {/* Card 1: Budget Mode */}
          <div
            onClick={() => setSelectedMode('budget')}
            style={{
              display: 'flex',
              gap: '16px',
              padding: '20px',
              borderRadius: '20px',
              background: selectedMode === 'budget' ? 'var(--accent-light)' : 'var(--bg-secondary)',
              border: selectedMode === 'budget' ? '2.5px solid var(--accent)' : '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}
          >
            {/* Green icon block */}
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: selectedMode === 'budget' ? 'var(--accent)' : '#10b981',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <PiggyBank size={24} />
            </div>
            
            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                Budget Mode
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.45 }}>
                Proactive financial planning. Set monthly limits for categories, track remaining balances, and get alerts before you overspend. Best for disciplined savings.
              </div>
              
              {/* Badges */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                {['LIMITS', 'PLANNING', 'ALERTS'].map(tag => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      color: 'var(--text-secondary)',
                      background: '#f1f5f9',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      letterSpacing: '0.5px'
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Tracker Mode */}
          <div
            onClick={() => setSelectedMode('tracker')}
            style={{
              display: 'flex',
              gap: '16px',
              padding: '20px',
              borderRadius: '20px',
              background: selectedMode === 'tracker' ? 'var(--accent-light)' : 'var(--bg-secondary)',
              border: selectedMode === 'tracker' ? '2.5px solid var(--accent)' : '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}
          >
            {/* Purple/Blue/Gray icon block */}
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: selectedMode === 'tracker' ? 'var(--accent)' : 'rgba(99, 102, 241, 0.08)',
                color: selectedMode === 'tracker' ? 'white' : 'var(--text-secondary)',
                border: selectedMode === 'tracker' ? 'none' : '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <BarChart3 size={24} />
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                Tracker Mode
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.45 }}>
                Observational tracking. Log every expense as it happens to understand where your money goes. No strict limits, just pure visibility into spending habits.
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                {['HISTORY', 'INSIGHTS', 'LOGGING'].map(tag => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      color: 'var(--text-secondary)',
                      background: '#f1f5f9',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      letterSpacing: '0.5px'
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Custom Goal Banner Image Card */}
        <div
          style={{
            position: 'relative',
            height: '160px',
            borderRadius: '20px',
            backgroundImage: 'url("/goals_banner.png")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'flex-end',
            padding: '20px',
            overflow: 'hidden',
            marginBottom: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 100%)',
              zIndex: 1
            }}
          />
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ color: 'white', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.3px' }}>
              Focus on your goals
            </div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', fontWeight: 500 }}>
              Visualizing your path to financial freedom.
            </div>
          </div>
        </div>

        {/* Detailed Settings Section Card */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px' }}>
            Detailed Settings
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Setting Row 1 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Auto-switch based on date
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.3 }}>
                  Switch to Budget Mode on the 1st of the month
                </span>
              </div>
              <Toggle checked={autoSwitch} onChange={() => setAutoSwitch(!autoSwitch)} />
            </div>

            {/* Separator line */}
            <div style={{ height: '1px', background: 'var(--border)' }} />

            {/* Setting Row 2 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Advanced Analytics
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.3 }}>
                  Enable deeper insights for the selected mode
                </span>
              </div>
              <Toggle checked={advancedAnalytics} onChange={() => setAdvancedAnalytics(!advancedAnalytics)} />
            </div>
          </div>
        </div>

        {/* Save Preference Button */}
        <button
          onClick={handleSavePreference}
          style={{
            width: '100%',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '24px',
            padding: '14px 24px',
            fontSize: '0.95rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px var(--accent-glow)',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
        >
          Save Preference
        </button>

      </div>
    );
  }

  // --- SUB-PANEL: Categories Management ---
  if (activeSubPanel === 'categories') {
    return (
      <div className="page-content" style={{ paddingTop: '28px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'calc(var(--nav-height) + 24px)' }}>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={hideToast} />
        )}
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <button
            onClick={() => setActiveSubPanel(null)}
            style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex', color: 'var(--accent)' }}
          >
            <ArrowLeft size={24} style={{ strokeWidth: 2.2 }} />
          </button>
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-primary)', fontWeight: 800 }}>Categories</h1>
        </div>

        {/* Subtitle description */}
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '20px', paddingLeft: '4px' }}>
          Drag handles to reorder your spending priorities.
        </div>

        {/* Categories Cards List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {categories.map((cat, i) => {
            const budgetAmount = categoryBudgets[cat.id] || 0;
            return (
              <div key={cat.id}>
                <div
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '16px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    opacity: draggedIndex === i ? 0.4 : 1,
                    cursor: 'grab',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                    {/* Circle icon container */}
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <CategoryIcon icon={cat.icon} name={cat.name} size={18} color="var(--text-secondary)" />
                    </div>
                    {/* Title & dynamic monthly cap */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cat.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 500 }}>
                        Monthly cap: {currency.symbol}{budgetAmount.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Actions (Delete and Drag Handle) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '12px' }}>
                    <button
                      onClick={() => setConfirmDelete(confirmDelete === cat.id ? null : cat.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        borderRadius: '6px',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 size={16} />
                    </button>
                    <Equal size={20} color="var(--text-muted)" style={{ cursor: 'grab' }} />
                  </div>
                </div>

                {/* Confirm Delete Banner */}
                {confirmDelete === cat.id && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.05)',
                      border: '1px solid rgba(239, 68, 68, 0.15)',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      marginTop: '8px',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '0.82rem', color: '#dc2626', fontWeight: 600 }}>
                      Delete "{cat.name}"? This deletes its history.
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        style={{
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        style={{
                          background: 'white',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Dotted Create Custom Category Card */}
          <div
            onClick={() => setShowAddModal(true)}
            style={{
              background: 'rgba(4, 120, 87, 0.02)',
              border: '1.5px dashed rgba(4, 120, 87, 0.2)',
              borderRadius: '16px',
              padding: '24px 18px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              cursor: 'pointer',
              gap: '10px',
              marginTop: '8px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(4, 120, 87, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(4, 120, 87, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(4, 120, 87, 0.02)';
              e.currentTarget.style.borderColor = 'rgba(4, 120, 87, 0.2)';
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(4, 120, 87, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)'
            }}>
              <ListPlus size={20} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--accent)' }}>
              Create Custom Category
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500, maxWidth: '290px', lineHeight: 1.45 }}>
              Organize your finances exactly how you live. Add tags, icons, and limits.
            </div>
          </div>
        </div>

        {/* Bottom Add Category Pill Button */}
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            width: '100%',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '24px',
            padding: '14px 24px',
            fontSize: '0.95rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            marginTop: '24px',
            boxShadow: '0 4px 12px var(--accent-glow)',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
        >
          <Plus size={18} />
          <span>Add Category</span>
        </button>

        {/* Add Category Modal */}
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title" style={{ fontSize: '1.2rem', fontWeight: 800 }}>Add Category</span>
                <button className="modal-close" onClick={() => setShowAddModal(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label className="input-label" style={{ marginBottom: '6px', display: 'block' }}>Name</label>
                  <input
                    className="input-field"
                    type="text"
                    placeholder="e.g. Groceries"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    maxLength={20}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Icon</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px', width: '100%', boxSizing: 'border-box' }}>
                    {ICON_OPTIONS.map((icon) => {
                      const isSelected = newCatIcon === icon;
                      return (
                        <button
                          key={icon}
                          onClick={() => setNewCatIcon(icon)}
                          style={{
                            width: '100%',
                            aspectRatio: '1',
                            borderRadius: '50%',
                            background: isSelected ? 'var(--accent)' : 'transparent',
                            border: isSelected ? 'none' : '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.1s ease',
                            padding: 0,
                            minWidth: 0,
                          }}
                        >
                          <CategoryIcon
                            icon={icon}
                            size={16}
                            color={isSelected ? '#ffffff' : 'var(--text-primary)'}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div
                    style={{
                      background: 'var(--accent)',
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CategoryIcon icon={newCatIcon} name={newCatName} size={18} color="#ffffff" />
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    {newCatName || 'Preview'}
                  </span>
                </div>

                <button
                  className="btn-primary"
                  onClick={handleAddCategory}
                  disabled={addingCategory || !newCatName.trim()}
                  style={{
                    width: '100%',
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '16px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px var(--accent-glow)',
                    transition: 'all 0.2s ease',
                    marginTop: '8px'
                  }}
                >
                  {addingCategory ? 'Adding...' : 'Add Category'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- SUB-PANEL: Month End Report ---
  if (activeSubPanel === 'report') {
    const formattedReportMonth = new Date(`${reportMonth}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
      <div className="page-content" style={{ paddingTop: '28px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'calc(var(--nav-height) + 24px)' }}>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={hideToast} />
        )}
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <button
            onClick={() => setActiveSubPanel(null)}
            style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex', color: 'var(--accent)' }}
          >
            <ArrowLeft size={24} style={{ strokeWidth: 2.2 }} />
          </button>
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-primary)', fontWeight: 800 }}>Month End Report</h1>
        </div>

        {/* Description */}
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '20px', paddingLeft: '4px', lineHeight: 1.45 }}>
          Generate a detailed, official PDF financial statement for your tax records, expense audits, or budget reviews.
        </div>

        {/* Month Selector Card */}
        <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
            Select Month
          </div>
          <MonthPicker value={reportMonth} onChange={setReportMonth} />
        </div>

        {/* Statistics Preview Card */}
        <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px' }}>
            Report Summary Preview
          </div>

          {loadingReportStats ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', padding: '10px 0', textAlign: 'center' }}>
              Loading summary details...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Month:</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 700 }}>{formattedReportMonth}</span>
              </div>
              <div style={{ height: '1px', background: 'var(--border)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Transactions:</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 700 }}>{reportTxCount} logs</span>
              </div>
              <div style={{ height: '1px', background: 'var(--border)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Spent:</span>
                <span style={{ fontSize: '1rem', color: 'var(--accent)', fontWeight: 800 }}>{formatCurrency(reportTotalSpent, currency)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons Row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          {/* Preview Button */}
          <button
            onClick={handleOpenPreview}
            disabled={loadingReportStats || reportTxCount === 0}
            style={{
              width: '100%',
              background: reportTxCount === 0 ? 'var(--text-muted)' : 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '24px',
              padding: '14px 24px',
              fontSize: '0.95rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: reportTxCount === 0 ? 'not-allowed' : 'pointer',
              boxShadow: reportTxCount === 0 ? 'none' : '0 4px 12px var(--accent-glow)',
              transition: 'all 0.15s ease',
              opacity: reportTxCount === 0 ? 0.6 : 1,
            }}
          >
            <Eye size={18} />
            <span>Preview Report</span>
          </button>

          {/* Download Button */}
          <button
            onClick={handleGenerateReport}
            disabled={isGeneratingReport || loadingReportStats || reportTxCount === 0}
            style={{
              width: '100%',
              background: 'white',
              border: '1.5px solid var(--border)',
              borderRadius: '24px',
              padding: '12px 24px',
              fontSize: '0.95rem',
              fontWeight: 700,
              color: reportTxCount === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: reportTxCount === 0 || isGeneratingReport ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              opacity: reportTxCount === 0 ? 0.6 : 1,
            }}
          >
            <FileDown size={18} />
            <span>{isGeneratingReport ? 'Downloading...' : 'Download PDF Report'}</span>
          </button>
        </div>

        {/* AI Spending Analysis Helper */}
        <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(124, 58, 237, 0.04) 100%)', border: '1px solid rgba(99, 102, 241, 0.15)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Sparkles size={16} color="#6366f1" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>AI Spending Analysis</h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '16px', fontWeight: 500 }}>
            Analyze your spending pattern using Gemini, ChatGPT, or Claude. Copy a structured finance prompt containing your selected month's transaction summaries.
          </p>
          <button
            onClick={handleCopyAiPrompt}
            disabled={loadingReportStats || reportTxCount === 0}
            style={{
              width: '100%',
              background: 'white',
              border: '1.5px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '16px',
              padding: '12px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: reportTxCount === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              opacity: reportTxCount === 0 ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (reportTxCount > 0) {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.04)';
                e.currentTarget.style.borderColor = '#6366f1';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
            }}
          >
            <Copy size={14} />
            <span>{copiedPrompt ? 'Copied Prompt!' : 'Copy AI Prompt'}</span>
          </button>
        </div>

        {/* PDF Preview Modal */}
        {showPreviewModal && (
          <div className="modal-overlay" onClick={handleClosePreview} style={{ zIndex: 1000 }}>
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '20px' }}>
              
              {/* Modal Header */}
              <div className="modal-header" style={{ marginBottom: '16px', flexShrink: 0 }}>
                <span className="modal-title" style={{ fontSize: '1.2rem', fontWeight: 800 }}>Report Preview</span>
                <button className="modal-close" onClick={handleClosePreview} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', minHeight: '200px' }}>
                {previewLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '250px', gap: '16px' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Compiling statement...</span>
                  </div>
                ) : (
                  <>
                    {pdfUrl ? (
                      /* Browser Mode: Render actual PDF inside iframe */
                      <iframe
                        src={`${pdfUrl}#toolbar=0&navpanes=0`}
                        style={{
                          width: '100%',
                          height: '400px',
                          border: '1px solid var(--border)',
                          borderRadius: '16px',
                          background: '#f8fafc',
                          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                        }}
                      />
                    ) : (
                      /* Mobile Mode: Render stylized premium document mockup */
                      <div
                        style={{
                          background: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '16px',
                          padding: '24px 20px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                          position: 'relative',
                          overflow: 'hidden',
                          fontFamily: 'Helvetica, Arial, sans-serif'
                        }}
                      >
                        {/* Top Accent bar */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'var(--accent)' }} />

                        {/* Document Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', fontWeight: 800, fontSize: '1.25rem', lineHeight: 1.1 }}>
                              <span style={{ color: 'var(--accent)' }}>My<span style={{ color: '#52666f' }}>ser</span></span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)' }}>FINANCIAL STATEMENT</div>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 600 }}>
                              PERIOD: {formattedReportMonth.toUpperCase()}
                            </div>
                          </div>
                        </div>

                        <div style={{ height: '1px', background: '#e2e8f0', marginBottom: '16px' }} />

                        {/* Metadata Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                          <div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Prepared For:</div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginTop: '3px' }}>{user?.displayName || 'Myser User'}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '1px' }}>{user?.email || 'local-user@myser.app'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Generated:</div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginTop: '3px' }}>{new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '1px' }}>Status: Official Ledger</div>
                          </div>
                        </div>

                        {/* Stat Summary Box */}
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                          <div>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 600 }}>TOTAL SPENT</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)', marginTop: '2px' }}>{formatCurrency(reportTotalSpent, currency)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 600 }}>TRANSACTION LOGS</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>{reportTxCount} Entries</div>
                          </div>
                        </div>

                        {/* Mini Ledger Preview */}
                        <div>
                          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                            Recent Transactions Preview
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {previewTransactions.map((tx) => (
                              <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '4px 0', borderBottom: '1px dashed #f1f5f9' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontWeight: 700, color: '#1e293b' }}>{tx.category_name}</span>
                                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{tx.date} • {tx.comment || tx.note || '—'}</span>
                                </div>
                                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{formatCurrency(tx.amount, currency)}</span>
                              </div>
                            ))}
                            {reportTxCount > 3 && (
                              <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '6px' }}>
                                ... and {reportTxCount - 3} more transactions logged in the statement.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
                {/* Share Option */}
                <button
                  onClick={handleShareReport}
                  disabled={previewLoading}
                  style={{
                    flex: 1,
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '14px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px var(--accent-glow)'
                  }}
                >
                  <Share2 size={16} />
                  <span>Share Report</span>
                </button>

                {/* Save PDF Option */}
                <button
                  onClick={handleDownloadReport}
                  disabled={previewLoading}
                  style={{
                    flex: 1,
                    background: 'white',
                    border: '1.5px solid var(--border)',
                    borderRadius: '16px',
                    padding: '12px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <FileDown size={16} />
                  <span>Save PDF</span>
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    );
  }

  // --- MAIN SETTINGS DASHBOARD ---
  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="page-content" style={{ paddingTop: '28px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'calc(var(--nav-height) + 24px)' }}>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
      
      <PageHeader title="Settings" />

      {/* Profile Card */}
      <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              position: 'relative',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              padding: '3px',
              border: '2.5px solid var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
            ) : (
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.4rem', fontWeight: 800 }}>
                {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{user?.displayName || 'User'}</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '2px 0 0', fontWeight: 500 }}>{user?.email || ''}</p>
          </div>
        </div>
        <BadgeCheck size={22} color="#94a3b8" style={{ flexShrink: 0 }} />
      </div>

      {/* PREFERENCES SECTION */}
      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
        Preferences
      </div>
      <div className="card" style={{ padding: '0 16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Row 1: Currency */}
          <div
            onClick={() => setActiveSubPanel('currency')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 0',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Banknote size={18} color="var(--text-secondary)" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Currency</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)' }}>{currency.code}</span>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>
          </div>

          {/* Row 2: Categories */}
          <div
            onClick={() => setActiveSubPanel('categories')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 0',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Shapes size={18} color="var(--text-secondary)" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Categories</span>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>

          {/* Row 3: App Mode */}
          <div
            onClick={() => setActiveSubPanel('appMode')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 0',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AppModeIcon />
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block' }}>App Mode</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px', display: 'block' }}>Budget vs Tracker</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{mode}</span>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>
          </div>

          {/* Row 4: Month End Report */}
          <div
            onClick={() => setActiveSubPanel('report')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 0',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FileText size={18} color="var(--text-secondary)" />
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block' }}>Month End Report</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px', display: 'block' }}>PDF Statements & AI Analysis</span>
              </div>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>
        </div>
      </div>

      {/* SYSTEM SECTION */}
      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
        System
      </div>
      <div className="card" style={{ padding: '0 16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Row 1: Notifications */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 0',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Bell size={18} color="var(--text-secondary)" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Notifications</span>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>

          {/* Row 2: Security */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 0',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Shield size={18} color="var(--text-secondary)" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Security</span>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </div>
        </div>
      </div>

      {/* Cloud Sync */}
      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
        Cloud Sync
      </div>
      <div className="card" style={{ padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Sync to Cloud
              {syncOn && (
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: syncStatus === 'synced' ? 'rgba(22, 163, 74, 0.1)' : syncStatus === 'syncing' ? 'rgba(101, 88, 232, 0.1)' : syncStatus === 'error' ? 'rgba(220, 38, 38, 0.1)' : 'transparent',
                  color: syncStatus === 'synced' ? 'var(--success)' : syncStatus === 'syncing' ? 'var(--accent)' : syncStatus === 'error' ? 'var(--danger)' : 'var(--text-muted)',
                }}>
                  {syncStatus === 'synced' ? 'Synced' : syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Error' : ''}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>
              {syncOn ? 'Data syncs automatically across devices' : 'Data is stored locally on this device'}
            </div>
          </div>
          <button
            onClick={async () => {
              if (syncOn) {
                disableSync();
                showToast('Cloud sync disabled', 'success');
              } else {
                await enableSync();
                showToast('Cloud sync enabled!', 'success');
              }
            }}
            disabled={syncStatus === 'syncing'}
            style={{
              background: syncOn ? 'var(--accent)' : 'var(--bg-elevated)',
              border: syncOn ? 'none' : '1px solid var(--border)',
              borderRadius: '20px',
              padding: '8px 16px',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: syncOn ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              minWidth: '70px',
              flexShrink: 0,
            }}
          >
            {syncStatus === 'syncing' ? '...' : syncOn ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {/* Clear History Button */}
      <button
        onClick={() => { setClearStep(1); setShowClearModal(true); }}
        style={{
          width: '100%',
          background: 'rgba(239, 68, 68, 0.04)',
          border: '1px solid rgba(239, 68, 68, 0.15)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: '#dc2626',
          fontWeight: 700,
          fontSize: '0.95rem',
          cursor: 'pointer',
          marginBottom: '12px',
        }}
      >
        <Trash2 size={16} />
        <span>Clear History</span>
      </button>

      {/* Clear History Modal */}
      {showClearModal && (
        <div className="modal-overlay" onClick={() => !clearing && (setShowClearModal(false), setClearStep(1))}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Clear History</span>
              <button className="modal-close" onClick={() => !clearing && (setShowClearModal(false), setClearStep(1))}>✕</button>
            </div>

            {clearStep === 1 ? (
              <>
                <div style={{ background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.2)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--danger)', marginBottom: '8px' }}>This will permanently delete:</div>
                  <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.8 }}>
                    <li>All transactions</li>
                    <li>All budgets</li>
                    <li>All receipts and documents</li>
                    <li>All cloud data in Firestore</li>
                  </ul>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '24px', lineHeight: 1.5 }}>
                  Your account stays active. Default categories will be restored. This cannot be undone.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    onClick={() => setClearStep(2)}
                    style={{ width: '100%', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    I understand, continue
                  </button>
                  <button
                    onClick={() => { setShowClearModal(false); setClearStep(1); }}
                    style={{ width: '100%', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.2)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--danger)', marginBottom: '6px' }}>Are you absolutely sure?</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                    Every transaction, budget, and receipt will be wiped from this device and the cloud. There is no way to recover this data.
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    disabled={clearing}
                    onClick={async () => {
                      if (!user) return;
                      setClearing(true);
                      try {
                        await deleteAllCloudData(user.uid);
                        await wipeLocalData();
                      } finally {
                        setClearing(false);
                        setShowClearModal(false);
                        setClearStep(1);
                      }
                    }}
                    style={{ width: '100%', background: clearing ? 'var(--text-muted)' : 'var(--danger)', color: 'white', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '0.95rem', fontWeight: 700, cursor: clearing ? 'not-allowed' : 'pointer' }}
                  >
                    {clearing ? 'Wiping data...' : 'Yes, delete everything'}
                  </button>
                  <button
                    onClick={() => { setShowClearModal(false); setClearStep(1); }}
                    disabled={clearing}
                    style={{ width: '100%', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sign Out Button */}
      <button
        onClick={() => setShowSignOutModal(true)}
        style={{
          width: '100%',
          background: 'rgba(239, 68, 68, 0.04)',
          border: '1px solid rgba(239, 68, 68, 0.15)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: '#dc2626',
          fontWeight: 700,
          fontSize: '0.95rem',
          cursor: 'pointer',
        }}
      >
        <LogOut size={16} />
        <span>Sign Out</span>
      </button>

      {/* Sign Out Confirmation Modal */}
      {showSignOutModal && (
        <div className="modal-overlay" onClick={() => !signingOut && setShowSignOutModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Sign Out</span>
              <button className="modal-close" onClick={() => !signingOut && setShowSignOutModal(false)}>✕</button>
            </div>

            <div style={{
              background: syncOn ? 'rgba(22, 163, 74, 0.08)' : 'rgba(220, 38, 38, 0.08)',
              border: `1px solid ${syncOn ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`,
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              textAlign: 'center',
            }}>
              {syncOn ? (
                <>
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>✓</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--success)' }}>
                    Your data is synced to cloud
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    You can sign back in anytime to restore it.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⚠️</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--danger)' }}>
                    Cloud Sync is off
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
                    Your local data will be permanently deleted when you sign out. Enable sync to save it first.
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {!syncOn && (
                <button
                  onClick={async () => {
                    if (!user) return;
                    setSigningOut(true);
                    try {
                      await uploadAllData(user.uid);
                      await signOut();
                    } finally {
                      setSigningOut(false);
                      setShowSignOutModal(false);
                    }
                  }}
                  disabled={signingOut}
                  style={{ width: '100%', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  {signingOut ? 'Syncing & signing out...' : 'Sync & Sign Out'}
                </button>
              )}

              <button
                onClick={async () => {
                  setSigningOut(true);
                  await signOut();
                  setSigningOut(false);
                  setShowSignOutModal(false);
                }}
                disabled={signingOut}
                style={{
                  width: '100%',
                  background: syncOn ? 'var(--danger)' : 'rgba(220, 38, 38, 0.06)',
                  color: syncOn ? 'white' : 'var(--danger)',
                  border: syncOn ? 'none' : '1px solid rgba(220, 38, 38, 0.2)',
                  borderRadius: '14px',
                  padding: '14px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {signingOut ? 'Signing out...' : syncOn ? 'Sign Out' : 'Sign Out Without Syncing'}
              </button>

              <button
                onClick={() => setShowSignOutModal(false)}
                disabled={signingOut}
                style={{ width: '100%', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
