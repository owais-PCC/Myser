import { addPendingLog, getCategories, updateDocumentFileName, lookupMerchantCategory } from './db';
import { pullGlobalDictionary } from './firestore-sync';

// ---- CATEGORY KEYWORDS (weighted) ----
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Food': [
    'restaurant', 'cafe', 'cafeteria', 'pizza', 'burger', 'food', 'kitchen', 'swiggy', 'zomato',
    'kfc', 'mcdonalds', 'mcdonald', 'subway', 'dominos', 'pizza hut', 'hardees',
    'coffee', 'americano', 'latte', 'cappuccino', 'espresso', 'mocha', 'macchiato',
    'tea', 'chai', 'coke', 'pepsi', 'sprite', 'fanta', 'juice', 'smoothie',
    'fries', 'chicken', 'sandwich', 'wrap', 'salad', 'soup',
    'cookie', 'cake', 'bakery', 'pastry', 'donut', 'muffin', 'croissant',
    'dine', 'dining', 'server', 'waiter', 'waitress', 'table', 'guests',
    'biryani', 'karahi', 'nihari', 'paratha', 'desi', 'tandoor', 'bbq', 'tikka', 'naan',
    'kebab', 'seekh', 'chapli', 'haleem', 'chana', 'daal', 'roti', 'pulao',
    'starbucks', 'costa', 'second cup', 'gloria jeans', 'chick-fil-a', 'chipotle',
    'wendy', 'taco', 'sushi', 'ramen', 'noodle', 'wok', 'grill',
    'foodpanda', 'cheetay', 'eat',
  ],
  'Groceries': [
    'carrefour', 'metro', 'grocery', 'supermarket', 'mart', 'store', 'hypermarket',
    'imtiaz', 'naheed', 'hyperstar', 'al-fatah', 'al fatah', 'agha', 'kiryana',
    'aldi', 'lidl', 'costco', 'walmart', 'target',
    'milk', 'bread', 'eggs', 'flour', 'rice', 'sugar', 'oil', 'ghee', 'atta',
  ],
  'Fuel': [
    'shell', 'pso', 'fuel', 'petrol', 'diesel', 'pump', 'cng', 'gasoline',
    'litre', 'liter', 'gallon', 'filling station', 'gas station',
    'attock', 'hascol', 'byco', 'aramco', 'total parco', 'caltex',
  ],
  'Health': [
    'pharmacy', 'medical', 'clinic', 'hospital', 'medicine', 'drug', 'chemist',
    'lab', 'laboratory', 'doctor', 'prescription', 'tablet', 'capsule', 'syrup',
    'dawakhana', 'shifa', 'aga khan', 'essa lab', 'medlife', 'oladoc',
    'dental', 'dentist', 'optician', 'eye', 'xray', 'x-ray', 'scan',
  ],
  'Clothes': [
    'fashion', 'clothing', 'garments', 'textile', 'wear', 'apparel',
    'zara', 'outfitters', 'h&m', 'uniqlo', 'nike', 'adidas', 'puma',
    'gul ahmed', 'khaadi', 'bonanza', 'alkaram', 'junaid jamshed', 'j.',
    'sapphire', 'sana safinaz', 'bareeze', 'limelight', 'ethnic',
    'shirt', 'trouser', 'jeans', 'kurta', 'shalwar',
  ],
  'Utilities': [
    'electric', 'electricity', 'water', 'utility', 'bill',
    'sui', 'wapda', 'lesco', 'kesc', 'k-electric', 'sngpl', 'ssgc',
    'sui northern', 'sui southern', 'ptcl', 'internet', 'broadband',
    'wifi', 'cable', 'telephone', 'phone bill',
  ],
  'Entertainment': [
    'cinema', 'movie', 'netflix', 'spotify', 'game', 'theatre', 'theater',
    'amusement', 'concert', 'ticket', 'park', 'museum', 'show',
    'youtube', 'disney', 'hbo', 'amazon prime',
  ],
  'Transport': [
    'uber', 'careem', 'ride', 'taxi', 'cab', 'bus', 'train', 'airline', 'flight',
    'parking', 'toll', 'fare', 'bykea', 'indriver',
    'pia', 'airblue', 'serene', 'emirates', 'flynas',
  ],
  'Charity': [
    'donation', 'charity', 'zakat', 'sadqa', 'sadaqah', 'edhi', 'ngo',
    'welfare', 'fund', 'orphan', 'masjid', 'mosque',
  ],
  'Education': [
    'school', 'university', 'college', 'tuition', 'academy', 'course',
    'book', 'bookstore', 'library', 'stationery', 'notebook', 'pen',
    'fee', 'semester', 'exam', 'institute',
  ],
};

// ---- KNOWN BRANDS ----
const KNOWN_BRANDS = [
  'carrefour', 'metro', 'imtiaz', 'naheed', 'hyperstar', 'chase', 'al fatah', 'al-fatah', 'agha',
  'kfc', 'mcdonalds', 'mcdonald', 'hardees', 'subway', 'pizza hut', 'dominos', 'burger king',
  'shell', 'pso', 'total parco', 'caltex', 'attock', 'hascol', 'byco', 'aramco',
  'daraz', 'foodpanda', 'bykea', 'careem', 'uber',
  'starbucks', 'second cup', 'gloria jeans', 'costa coffee',
  'gul ahmed', 'khaadi', 'outfitters', 'junaid jamshed', 'j.', 'sapphire', 'alkaram', 'bonanza',
  'shifa', 'aga khan', 'essa lab',
  'lesco', 'wapda', 'k-electric', 'ptcl', 'sngpl', 'ssgc',
];

// ---- IMAGE RESIZE ----
function resizeImage(base64: string, maxWidth: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

// ---- AMOUNT EXTRACTION ----
function isSkipLine(lower: string): boolean {
  return /\b(sub\s*total|subtotal|tax|change|cash|tendered|received|paid|balance|discount|vat|gst|service\s*charge|tip)\b/.test(lower);
}

function extractNumberFromLine(line: string): number | null {
  // Match: $5.71, ₨350, Rs 1,350.00, Rs.350, PKR 1200, plain 5.71, plain 350
  const patterns = [
    /[\$₨£€]\s*(\d[\d,]*\.?\d*)/,
    /(?:rs\.?|pkr|rupees)\s*(\d[\d,]*\.?\d*)/i,
    /(\d[\d,]*\.\d{1,2})\s*$/,
    /(\d[\d,]+)\s*$/,
  ];
  for (const p of patterns) {
    const m = line.match(p);
    if (m) {
      const val = parseFloat(m[1].replace(/,/g, ''));
      if (val > 0 && val < 10000000) return val;
    }
  }
  return null;
}

function extractAmount(text: string): number {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  // Priority 1: exact total keyword lines
  const totalKeywords = /\b(grand\s*total|bill\s*total|net\s*total|total\s*amount|amount\s*payable|amt\s*due|amount\s*due|to\s*pay|payable|net\s*amount|balance\s*due|total|amount)\b/i;

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (isSkipLine(lower)) continue;
    if (totalKeywords.test(lower)) {
      // Try number on same line
      const val = extractNumberFromLine(lines[i]);
      if (val !== null) return val;
      // Try next line if this line had no number
      if (i + 1 < lines.length) {
        const nextVal = extractNumberFromLine(lines[i + 1]);
        if (nextVal !== null) return nextVal;
      }
    }
  }

  // Priority 2: currency-prefixed amounts (skip lines near change/cash/tendered)
  const amounts: { val: number; lineIdx: number }[] = [];
  const currencyPattern = /(?:[\$₨£€]|rs\.?|pkr)\s*(\d[\d,]*\.?\d*)/gi;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (/\b(change|cash|tendered|received|paid|balance)\b/.test(lower)) continue;
    let match;
    while ((match = currencyPattern.exec(lines[i])) !== null) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (val > 0 && val < 10000000) amounts.push({ val, lineIdx: i });
    }
    currencyPattern.lastIndex = 0;
  }
  if (amounts.length > 0) {
    amounts.sort((a, b) => b.val - a.val);
    // If largest is a round number and there are others, it might be cash — take second
    if (amounts.length > 1 && amounts[0].val % 1 === 0 && amounts[1].val % 1 !== 0) {
      return amounts[1].val;
    }
    return amounts[0].val;
  }

  // Priority 3: any decimal number, largest first, skip change/cash lines
  const allNums: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (/\b(change|cash|tendered|received)\b/.test(lower)) continue;
    const nums = lines[i].match(/(\d[\d,]*\.\d{1,2})/g);
    if (nums) {
      for (const n of nums) {
        const val = parseFloat(n.replace(/,/g, ''));
        if (val > 0 && val < 10000000) allNums.push(val);
      }
    }
  }
  if (allNums.length > 0) {
    allNums.sort((a, b) => b - a);
    return allNums[0];
  }

  // Priority 4: any number at all
  const anyNums = text.match(/(\d[\d,]*)/g);
  if (anyNums) {
    const vals = anyNums.map((n) => parseFloat(n.replace(/,/g, ''))).filter((v) => v > 0 && v < 10000000);
    vals.sort((a, b) => b - a);
    if (vals.length > 0) return vals[0];
  }

  return 0;
}

// ---- DATE EXTRACTION ----
function extractDate(text: string): string | null {
  const patterns: { regex: RegExp; parse: (m: RegExpMatchArray) => string | null }[] = [
    {
      regex: /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/,
      parse: (m) => {
        const a = parseInt(m[1]), b = parseInt(m[2]), y = parseInt(m[3]);
        if (a > 12) return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
        return `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
      },
    },
    {
      regex: /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,
      parse: (m) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`,
    },
    {
      regex: /(\d{1,2})\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]+(\d{4})/i,
      parse: (m) => {
        const d = new Date(m[0]);
        return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
      },
    },
    {
      regex: /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})[\s,]+(\d{4})/i,
      parse: (m) => {
        const d = new Date(m[0]);
        return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
      },
    },
  ];

  for (const { regex, parse } of patterns) {
    const match = text.match(regex);
    if (match) {
      const result = parse(match);
      if (result) return result;
    }
  }
  return null;
}

// ---- MERCHANT EXTRACTION ----
interface WordData {
  text: string;
  confidence: number;
}

function extractMerchant(text: string, words?: WordData[]): string {
  const lowerText = text.toLowerCase();

  // Step 1: check known brands
  for (const brand of KNOWN_BRANDS) {
    if (lowerText.includes(brand)) {
      return brand.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 2 && l.length < 60);
  const skipPatterns = /^(receipt|invoice|bill|tax|date|time|total|amount|cash|change|thank|have a|tel|ph|fax|www|http|email|\d{5,}|---)/i;

  // Step 2: if we have word confidence data, use high-confidence words from first 5 lines
  if (words && words.length > 0) {
    const highConfWords = words.filter((w) => w.confidence > 60 && w.text.length > 1);
    if (highConfWords.length > 0) {
      // Group words by line (approximate by looking at first 5 text lines)
      for (const line of lines.slice(0, 5)) {
        const lower = line.toLowerCase();
        if (skipPatterns.test(line)) continue;
        if (/^\d+$/.test(line)) continue;
        // Check if this line has high-confidence words
        const lineWords = line.split(/\s+/);
        const avgConf = lineWords.reduce((sum, lw) => {
          const found = highConfWords.find((hw) => hw.text.toLowerCase() === lw.toLowerCase());
          return sum + (found ? found.confidence : 0);
        }, 0) / lineWords.length;
        if (avgConf > 50) {
          const cleaned = line.replace(/[^a-zA-Z0-9\s&'.-]/g, '').trim();
          if (cleaned.length > 2) return cleaned.slice(0, 40);
        }
      }
    }
  }

  // Step 3: fallback — first meaningful line
  for (const line of lines.slice(0, 5)) {
    if (skipPatterns.test(line)) continue;
    if (/^\d+$/.test(line)) continue;
    if (/^\W+$/.test(line)) continue;
    const cleaned = line.replace(/[^a-zA-Z0-9\s&'.-]/g, '').trim();
    if (cleaned.length > 2) return cleaned.slice(0, 40);
  }

  return 'Unknown Merchant';
}

// ---- CATEGORY MATCHING (zone-weighted) ----
export type CategoryConfidence = 'low' | 'medium' | 'high';

async function matchCategory(text: string): Promise<{ categoryId: number; confidence: CategoryConfidence }> {
  const categories = await getCategories();
  const lines = text.split('\n');
  const totalLines = lines.length;

  // Split into zones
  const headerEnd = Math.floor(totalLines * 0.2);
  const bodyEnd = Math.floor(totalLines * 0.8);

  const headerText = lines.slice(0, headerEnd).join(' ').toLowerCase();
  const bodyText = lines.slice(headerEnd, bodyEnd).join(' ').toLowerCase();
  const footerText = lines.slice(bodyEnd).join(' ').toLowerCase();

  let bestMatch = -1;
  let bestScore = 0;

  for (const cat of categories) {
    const keywords = CATEGORY_KEYWORDS[cat.name] || [];
    let score = 0;
    for (const kw of keywords) {
      // Header: 1x weight
      if (headerText.includes(kw)) score += 1;
      // Body (items): 2x weight
      if (bodyText.includes(kw)) score += 2;
      // Footer: 1x weight
      if (footerText.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = cat.id;
    }
  }

  let confidence: CategoryConfidence = 'low';
  if (bestScore >= 5) confidence = 'high';
  else if (bestScore >= 2) confidence = 'medium';

  if (bestMatch === -1) {
    const other = categories.find((c) => c.name === 'Other');
    return { categoryId: other?.id || categories[0]?.id || 1, confidence: 'low' };
  }
  return { categoryId: bestMatch, confidence };
}

// ---- MAIN PIPELINE ----
async function recognizeText(base64Data: string): Promise<string> {
  // Try native ML Kit first (1-3 seconds on device)
  try {
    const { Capacitor, registerPlugin } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const TextRecognizer = registerPlugin('TextRecognizer') as {
        recognize: (opts: { base64: string }) => Promise<{ text: string }>;
      };
      const result = await TextRecognizer.recognize({ base64: base64Data });
      return result.text;
    }
  } catch { /* not native, fall through */ }

  // Browser fallback — Tesseract.js (dev/testing)
  const resizedDataUrl = await resizeImage(base64Data, 1200);
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  const { data } = await worker.recognize(resizedDataUrl);
  await worker.terminate();
  return data.text;
}

export async function processReceipt(documentId: number, base64Data: string): Promise<void> {
  const rawText = await recognizeText(base64Data);

  const amount = extractAmount(rawText);
  const date = extractDate(rawText) || new Date().toISOString().slice(0, 10);
  const merchant = extractMerchant(rawText);

  // Priority 1: Local merchant memory (user's own corrections)
  const memorized = await lookupMerchantCategory(merchant);
  let categoryId: number = 0;
  if (memorized && memorized.confidence >= 1) {
    categoryId = memorized.categoryId;
  } else {
    // Priority 2: Global crowd-sourced pool
    let foundGlobal = false;
    try {
      const globalDict = await pullGlobalDictionary();
      const merchantKey = merchant.toLowerCase().replace(/[^a-z0-9]/g, '');
      const globalMatch = globalDict.find((g) => {
        const gKey = g.merchant.toLowerCase().replace(/[^a-z0-9]/g, '');
        return merchantKey.includes(gKey) || gKey.includes(merchantKey);
      });
      if (globalMatch && globalMatch.confidence >= 2) {
        const categories = await getCategories();
        const cat = categories.find((c) => c.name === globalMatch.categoryName);
        if (cat) {
          categoryId = cat.id;
          foundGlobal = true;
        }
      }
    } catch { /* offline — skip global */ }

    // Priority 3: Local keyword matching
    if (!foundGlobal) {
      const matched = await matchCategory(rawText);
      categoryId = matched.categoryId;
    }
  }

  // Final fallback
  if (categoryId === 0) {
    const cats = await getCategories();
    const other = cats.find((c) => c.name === 'Other');
    categoryId = other?.id || cats[0]?.id || 1;
  }

  const pendingId = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await addPendingLog({
    id: pendingId,
    document_id: documentId,
    merchant,
    amount,
    category_id: categoryId,
    date,
    raw_ocr_text: rawText,
  });

  const cleanName = `${merchant} ${date}`;
  await updateDocumentFileName(documentId, cleanName);
}
