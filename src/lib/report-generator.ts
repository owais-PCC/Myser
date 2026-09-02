import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getTransactionsByMonth, getSpendingByCategory, getMonthlyBudget } from './db';
import { formatCurrency, CurrencyConfig } from './currency';

/**
 * Generates an official, premium PDF financial statement for the selected month
 * and triggers its download (either via browser or Capacitor filesystem on mobile).
 */
export async function generateMonthEndReportDoc(
  month: string,
  user: { displayName: string | null; email: string | null } | null,
  currency: CurrencyConfig,
  mode: 'budget' | 'tracker'
): Promise<jsPDF> {
  // 1. Load data from SQLite database
  const transactions = await getTransactionsByMonth(month);
  const catSpending = await getSpendingByCategory(month);
  const monthlyBudgetLimit = await getMonthlyBudget(month);

  const totalSpent = catSpending.reduce((sum, c) => sum + c.spent, 0);

  // Calculate month name and days
  const [yearNum, monthNum] = month.split('-').map(Number);
  const totalDays = new Date(yearNum, monthNum, 0).getDate();
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  
  let daysElapsed = totalDays;
  if (month === currentMonthStr) {
    daysElapsed = Math.max(1, Math.min(new Date().getDate(), totalDays));
  } else if (month > currentMonthStr) {
    daysElapsed = 1;
  }

  const avgDaily = totalSpent > 0 ? totalSpent / daysElapsed : 0;
  const avgWeekly = avgDaily * 7;
  const formattedMonth = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // 2. Initialize jsPDF Document (A4 size: 210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor: [number, number, number] = [20, 152, 103]; // Myserly Green (#149867)
  const darkSlate: [number, number, number] = [15, 23, 42]; // Slate 900
  const secondaryColor: [number, number, number] = [82, 102, 111]; // Myserly Slate Gray (#52666f)
  const lightBg: [number, number, number] = [248, 250, 252]; // Slate 50
  const borderBg: [number, number, number] = [226, 232, 240]; // Slate 200

  // Helper to add standard header and footer on each page
  const addPageDecorations = (pageNumber: number, totalPages: number) => {
    // Top border accent bar
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 4, 'F');

    // Footer divider line
    doc.setDrawColor(borderBg[0], borderBg[1], borderBg[2]);
    doc.setLineWidth(0.3);
    doc.line(15, 282, 195, 282);

    // Footer Text
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('Myserly Expense Tracker • Official Monthly Financial Report', 15, 287);
    doc.text(`Page ${pageNumber} of ${totalPages}`, 195, 287, { align: 'right' });
  };

  // --- PAGE 1: COVER PAGE & EXECUTIVE SUMMARY ---

  // Title Logo Block (Actual Myserly stylized "M" logo)
  doc.setLineCap('round');
  doc.setLineJoin('round');
  doc.setLineWidth(1.5);
  
  // Left Green segment
  doc.setDrawColor(20, 152, 103);
  doc.line(16.8, 22.0, 16.8, 14.6);
  doc.line(16.8, 14.6, 21.0, 18.6);
  
  // Right Slate Gray segment
  doc.setDrawColor(82, 102, 111);
  doc.line(21.0, 18.6, 25.2, 14.6);
  doc.line(25.2, 14.6, 25.2, 22.0);

  // App Name & Document Title (Myserly Wordmark)
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 152, 103); // My
  doc.text('My', 31, 19.5);
  doc.setTextColor(82, 102, 111); // serly
  doc.text('serly', 39, 19.5);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('PERSONAL WEALTH MANAGEMENT', 31, 23.5);

  // Right Aligned Document Header
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('FINANCIAL STATEMENT', 195, 19.5, { align: 'right' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`STATEMENT PERIOD: ${formattedMonth.toUpperCase()}`, 195, 23.5, { align: 'right' });

  // Divider Line
  doc.setDrawColor(borderBg[0], borderBg[1], borderBg[2]);
  doc.setLineWidth(0.5);
  doc.line(15, 28, 195, 28);

  // Metadata Panel
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(15, 33, 180, 22, 2, 2, 'F');
  doc.setDrawColor(borderBg[0], borderBg[1], borderBg[2]);
  doc.roundedRect(15, 33, 180, 22, 2, 2, 'S');

  // Metadata Fields
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  
  doc.text('PREPARED FOR:', 20, 39);
  doc.text('REPORT GENERATED:', 90, 39);
  doc.text('ACCOUNT STATUS:', 150, 39);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  
  const displayName = user?.displayName || 'Myserly User';
  const emailStr = user?.email || 'local-user@myser.app';
  doc.text(`${displayName}`, 20, 44);
  doc.setFontSize(7.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(emailStr, 20, 48);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  const generatedTime = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  doc.text(generatedTime, 90, 44);

  const statusStr = syncOnFirebase() ? 'Cloud Synced' : 'Offline / Local';
  doc.text(statusStr, 150, 44);

  // Executive Summary Subtitle
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('Executive Summary', 15, 63);

  // Overview Widgets (3 rounded boxes in a row)
  const widgetW = 56;
  const widgetH = 24;
  const widgetY = 68;

  // Widget 1: Total Spent
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(15, widgetY, widgetW, widgetH, 2, 2, 'F');
  doc.setDrawColor(borderBg[0], borderBg[1], borderBg[2]);
  doc.roundedRect(15, widgetY, widgetW, widgetH, 2, 2, 'S');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('TOTAL SPENT', 20, widgetY + 6);
  doc.setFontSize(13);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(formatCurrency(totalSpent, currency), 20, widgetY + 15);

  // Widget 2: Monthly Limit (Budget Mode) or Daily Average (Tracker Mode)
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(15 + widgetW + 6, widgetY, widgetW, widgetH, 2, 2, 'F');
  doc.setDrawColor(borderBg[0], borderBg[1], borderBg[2]);
  doc.roundedRect(15 + widgetW + 6, widgetY, widgetW, widgetH, 2, 2, 'S');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);

  if (mode === 'budget') {
    doc.text('MONTHLY LIMIT', 15 + widgetW + 11, widgetY + 6);
    doc.setFontSize(13);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    const limitText = monthlyBudgetLimit ? formatCurrency(monthlyBudgetLimit, currency) : 'N/A';
    doc.text(limitText, 15 + widgetW + 11, widgetY + 15);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('Budget Allocation Mode', 15 + widgetW + 11, widgetY + 20);
  } else {
    doc.text('DAILY AVERAGE', 15 + widgetW + 11, widgetY + 6);
    doc.setFontSize(13);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.text(formatCurrency(avgDaily, currency), 15 + widgetW + 11, widgetY + 15);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(`Averaged over ${daysElapsed} days`, 15 + widgetW + 11, widgetY + 20);
  }

  // Widget 3: Remaining Budget (Budget Mode) or Weekly Average (Tracker Mode)
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(15 + (widgetW * 2) + 12, widgetY, widgetW, widgetH, 2, 2, 'F');
  doc.roundedRect(15 + (widgetW * 2) + 12, widgetY, widgetW, widgetH, 2, 2, 'S');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  
  if (mode === 'budget') {
    doc.text('REMAINING BUDGET', 15 + (widgetW * 2) + 17, widgetY + 6);
    doc.setFontSize(13);
    const diff = (monthlyBudgetLimit || 0) - totalSpent;
    if (diff >= 0) {
      doc.setTextColor(4, 120, 87); // Green
      doc.text(formatCurrency(diff, currency), 15 + (widgetW * 2) + 17, widgetY + 15);
    } else {
      doc.setTextColor(239, 68, 68); // Red (Overdraft)
      doc.text(`-${formatCurrency(Math.abs(diff), currency)}`, 15 + (widgetW * 2) + 17, widgetY + 15);
    }
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    const subLabel = monthlyBudgetLimit && (monthlyBudgetLimit - totalSpent >= 0) ? 'Under limit' : 'Limit exceeded';
    doc.text(subLabel, 15 + (widgetW * 2) + 17, widgetY + 20);
  } else {
    doc.text('WEEKLY AVERAGE', 15 + (widgetW * 2) + 17, widgetY + 6);
    doc.setFontSize(13);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.text(formatCurrency(avgWeekly, currency), 15 + (widgetW * 2) + 17, widgetY + 15);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('Average weekly rate', 15 + (widgetW * 2) + 17, widgetY + 20);
  }

  // Weekly Average Note or Transaction Count below widgets
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  if (mode === 'budget') {
    doc.text(`Weekly Pace: ${formatCurrency(avgWeekly, currency)}/week`, 15, widgetY + widgetH + 6);
    doc.setFont('Helvetica', 'normal');
    doc.text(` •   Transactions: ${transactions.length} total logged`, 75, widgetY + widgetH + 6);
  } else {
    doc.text(`Transactions: ${transactions.length} total logged`, 15, widgetY + widgetH + 6);
  }

  // Category Spending Breakdown Table Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('Spending by Category', 15, 107);

  // Filter out categories with no spending
  const activeCatSpending = catSpending.filter((c) => c.spent > 0);

  // Format Category table rows (No symbols/emojis in names!)
  const categoryRows = activeCatSpending.map((c) => {
    const spentAmount = c.spent;
    if (mode === 'budget') {
      const budgetAmount = c.budget;
      const budgetStr = budgetAmount > 0 ? formatCurrency(budgetAmount, currency) : '—';
      const percentStr = budgetAmount > 0 ? `${Math.round((spentAmount / budgetAmount) * 100)}%` : '—';
      return [c.name, budgetStr, formatCurrency(spentAmount, currency), percentStr];
    } else {
      const pct = totalSpent > 0 ? Math.round((spentAmount / totalSpent) * 100) : 0;
      const percentStr = `${pct}%`;
      return [c.name, formatCurrency(spentAmount, currency), percentStr];
    }
  });

  const categoryHeaders = mode === 'budget'
    ? [['Category', 'Budget Limit', 'Actual Spent', 'Utilization']]
    : [['Category', 'Actual Spent', 'Share of Total']];

  const categoryColumnStyles: Record<number, any> = mode === 'budget'
    ? {
        0: { halign: 'left' as const, fontStyle: 'bold' as const, cellWidth: 60 },
        1: { halign: 'right' as const, cellWidth: 40 },
        2: { halign: 'right' as const, cellWidth: 40 },
        3: { halign: 'right' as const, cellWidth: 40 },
      }
    : {
        0: { halign: 'left' as const, fontStyle: 'bold' as const, cellWidth: 80 },
        1: { halign: 'right' as const, cellWidth: 50 },
        2: { halign: 'right' as const, cellWidth: 50 },
      };

  // Render Category Table (Headers aligned with columns!)
  autoTable(doc, {
    startY: 112,
    margin: { left: 15, right: 15 },
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: darkSlate,
    },
    columnStyles: categoryColumnStyles,
    head: categoryHeaders,
    body: categoryRows,
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index > 0) {
        data.cell.styles.halign = 'right';
      }
    },
  });

  // Add decorative items to Page 1
  addPageDecorations(1, 2);

  // --- PAGE 2: DETAILED TRANSACTIONS ---
  doc.addPage();

  // Header Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('Detailed Transaction History', 15, 16);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`Detailed ledger of all ${transactions.length} items logged. Sorted chronologically.`, 15, 20);

  // Format Transaction Table rows (No symbols/emojis in names!)
  const transactionRows = transactions.map((t) => {
    const formattedDate = t.date;
    const catCell = t.category_name; // Pure category name, NO emoji prefix!
    const commentCell = t.comment || t.note || '—';
    const amountVal = formatCurrency(t.amount, currency);

    return [
      formattedDate,
      catCell,
      commentCell,
      amountVal,
    ];
  });

  // Render Transactions Table (Headers aligned, no Merchant note column)
  autoTable(doc, {
    startY: 24,
    margin: { left: 15, right: 15, bottom: 25 },
    theme: 'striped',
    headStyles: {
      fillColor: darkSlate,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: darkSlate,
    },
    columnStyles: {
      0: { halign: 'left' as const, cellWidth: 25 },
      1: { halign: 'left' as const, fontStyle: 'bold' as const, cellWidth: 45 },
      2: { halign: 'left' as const, cellWidth: 80 },
      3: { halign: 'right' as const, fontStyle: 'bold' as const, cellWidth: 30 },
    },
    head: [['Date', 'Category', 'User Comment', 'Amount']],
    body: transactionRows,
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 3) {
        data.cell.styles.halign = 'right';
      }
    },
  });

  // Add decorative items to Page 2
  // Note: If the transaction list is long, it might spawn page 3, 4, etc.
  // We can count pages and add decorations iteratively.
  const pageCount = doc.getNumberOfPages();
  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i);
    addPageDecorations(i, pageCount);
  }
  
  // Re-adjust page 1 footer count just in case the report spans more than 2 pages
  if (pageCount > 2) {
    doc.setPage(1);
    addPageDecorations(1, pageCount);
  }

  // 3. Return PDF Document
  return doc;
}

export async function saveOrSharePdf(
  doc: jsPDF,
  month: string
): Promise<{ success: boolean; method: string; fileName: string }> {
  const fileName = `myser-report-${month}.pdf`;
  const blob = doc.output('blob');

  // 1. Web Share API (iOS / Mobile Share Sheet — lets user pick "Save to Files", AirDrop, Mail, etc.)
  if (typeof window !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Myserly Report ${month}`,
          text: `Financial report for ${month}`,
        });
        return { success: true, method: 'share', fileName };
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return { success: false, method: 'cancelled', fileName };
      console.warn('Navigator share failed, attempting fallback:', e);
    }
  }

  // 2. HTML5 File System Access API (Desktop — lets user pick exact folder location!)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: 'PDF Document',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { success: true, method: 'picker', fileName: handle.name || fileName };
    } catch (e: any) {
      if (e.name === 'AbortError') return { success: false, method: 'cancelled', fileName };
      console.warn('File picker cancelled or failed:', e);
    }
  }

  // 3. Mobile Capacitor Filesystem fallback
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const base64 = doc.output('datauristring').split(',')[1];
      await Filesystem.writeFile({
        path: `Download/Myserly/${fileName}`,
        data: base64,
        directory: Directory.ExternalStorage,
        recursive: true,
      });
      return { success: true, method: 'filesystem', fileName };
    }
  } catch (err) {
    console.error('Capacitor filesystem write failed:', err);
  }

  // 4. Standard Browser Download Fallback
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { success: true, method: 'download', fileName };
}

export async function generateMonthEndReport(
  month: string,
  user: { displayName: string | null; email: string | null } | null,
  currency: CurrencyConfig,
  mode: 'budget' | 'tracker'
): Promise<string> {
  const doc = await generateMonthEndReportDoc(month, user, currency, mode);
  const result = await saveOrSharePdf(doc, month);
  return result.fileName;
}

/**
 * Builds a data-rich, formatted text prompt representing the month's metrics,
 * which the user can copy-paste into an LLM (Gemini, ChatGPT) for financial advice.
 */
export function generateAiPrompt(
  monthName: string,
  currency: CurrencyConfig,
  totalSpent: number,
  avgDaily: number,
  mode: 'budget' | 'tracker',
  monthlyBudget: number | null,
  catSpending: any[],
  transactions: any[]
): string {
  const symbol = currency.symbol;

  const categoriesList = catSpending
    .map((c) => {
      const spentStr = formatCurrency(c.spent, currency);
      if (mode === 'budget') {
        const limitStr = c.budget > 0 ? formatCurrency(c.budget, currency) : 'No limit';
        const percent = c.budget > 0 ? `(${Math.round((c.spent / c.budget) * 100)}% utilized)` : '';
        return `- ${c.name}: Spent ${spentStr} vs. Budget limit of ${limitStr} ${percent}`;
      } else {
        const pct = totalSpent > 0 ? Math.round((c.spent / totalSpent) * 100) : 0;
        return `- ${c.name}: Spent ${spentStr} (${pct}% of monthly total)`;
      }
    })
    .join('\n');

  // List top 15 transactions
  const topTransactions = transactions
    .slice(0, 15)
    .map((t) => {
      const commentStr = t.comment ? ` (Note: ${t.comment})` : '';
      return `- [${t.date}] ${t.category_name}: ${formatCurrency(t.amount, currency)} on "${t.note || 'Unknown'}"${commentStr}`;
    })
    .join('\n');

  const budgetModeInfo = mode === 'budget' && monthlyBudget
    ? `- Total Allocated Monthly Budget Limit: ${formatCurrency(monthlyBudget, currency)}`
    : '';

  return `I want you to analyze my monthly spending report from Myserly for ${monthName}. Here is the summary of my financial data:
- Currency: ${currency.code} (${symbol})
- Total Spent this month: ${formatCurrency(totalSpent, currency)}
- Average Daily Spend: ${formatCurrency(avgDaily, currency)}
${budgetModeInfo}

Category Spending Breakdown:
${categoriesList}

Top / Representative Transactions Logged (up to 15):
${topTransactions}

Please act as a wealth advisor and financial analyst. Based on this financial data, please provide:
1. **Executive Analysis**: A brief, high-level overview of my financial health and behavior for this month.
2. **Key Spending Drivers**: Detail what categories or specific transactions are driving my main expenses.
3. **Savings & Optimization Opportunities**: Pinpoint specific categories or areas where I am overspending or could optimize my budget. Indicate where I might have "budget leaks".
4. **Actionable Recommendations**: Provide 3 specific, realistic, and actionable tips I can implement starting next month to improve my savings rate and financial habits.
5. **AI limit adjustments recommendation**: Suggest how I should adjust my budgets/limits for next month based on this month's data.`;
}

// Utility to check if Firestore sync is enabled in localStorage
function syncOnFirebase(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('myser_sync_enabled') === 'true';
}
