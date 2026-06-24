import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { auth } from './firebase';
import {
  syncCategory, syncDeleteCategory, syncTransaction, syncDeleteTransaction,
  syncBudget, syncMonthlyBudget, syncCategoryReorder,
} from './firestore-sync';

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

const DB_KEY = 'financeapp_db';

export function resetDb() {
  db = null;
}

export const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Food', color: '#FF6B6B', icon: '🍔' },
  { id: 2, name: 'Fuel', color: '#4ECDC4', icon: '⛽' },
  { id: 3, name: 'Clothes', color: '#A29BFE', icon: '👗' },
  { id: 4, name: 'Utilities', color: '#FD79A8', icon: '💡' },
  { id: 5, name: 'Health', color: '#55EFC4', icon: '❤️' },
  { id: 6, name: 'Entertainment', color: '#FDCB6E', icon: '🎬' },
  { id: 7, name: 'Charity', color: '#81ECEC', icon: '🤝' },
  { id: 8, name: 'Transport', color: '#74B9FF', icon: '🚌' },
  { id: 9, name: 'Education', color: '#FAB1A0', icon: '📚' },
  { id: 10, name: 'Other', color: '#B2BEC3', icon: '📦' },
];

async function getSql(): Promise<SqlJsStatic> {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file: string) => `/${file}`,
    });
  }
  return SQL;
}

export async function getDb(): Promise<Database> {
  if (db) return db;

  const sql = await getSql();

  const saved = typeof window !== 'undefined' ? localStorage.getItem(DB_KEY) : null;

  if (saved) {
    const arr = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
    db = new sql.Database(arr);
    initSchema(db);
  } else {
    db = new sql.Database();
    initSchema(db);
    seedCategories(db);
    persistDb(db);
  }

  return db;
}

function initSchema(database: Database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS monthly_budget (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT UNIQUE,
      total_amount REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      storage_path TEXT,
      local_path TEXT,
      mime_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pending_logs (
      id TEXT PRIMARY KEY,
      document_id INTEGER,
      merchant TEXT,
      amount REAL,
      category_id INTEGER,
      date TEXT,
      raw_ocr_text TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS merchant_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_key TEXT NOT NULL UNIQUE,
      merchant_display TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      times_seen INTEGER NOT NULL DEFAULT 1,
      last_seen TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Drop old documents table that had data_base64 column
  try {
    const cols = database.exec("PRAGMA table_info(documents)");
    if (cols.length) {
      const hasOldCol = cols[0].values.some((row) => row[1] === 'data_base64');
      if (hasOldCol) {
        database.run('DROP TABLE documents');
        database.run(`CREATE TABLE documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          file_name TEXT NOT NULL,
          date TEXT NOT NULL,
          note TEXT,
          storage_path TEXT,
          local_path TEXT,
          mime_type TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`);
      }
    }
  } catch {
    // ignore
  }

  try {
    database.run('ALTER TABLE categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
    const rows = database.exec('SELECT id FROM categories ORDER BY id');
    if (rows.length) {
      rows[0].values.forEach((row, i) => {
        database.run('UPDATE categories SET sort_order = ? WHERE id = ?', [i, row[0] as number]);
      });
    }
  } catch {
    // column already exists
  }

  try { database.run('ALTER TABLE transactions ADD COLUMN document_id INTEGER'); } catch { /* exists */ }
  try { database.run('ALTER TABLE transactions ADD COLUMN comment TEXT'); } catch { /* exists */ }
}

function seedCategories(database: Database) {
  const stmt = database.prepare(
    'INSERT INTO categories (id, name, color, icon) VALUES (?, ?, ?, ?)'
  );
  for (const cat of DEFAULT_CATEGORIES) {
    stmt.run([cat.id, cat.name, cat.color, cat.icon]);
  }
  stmt.free();
}

function getUserId(): string | null {
  return auth.currentUser?.uid || null;
}

export function persistDb(database: Database) {
  if (typeof window === 'undefined') return;
  const data = database.export();
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < data.length; i += chunkSize) {
    binary += String.fromCharCode(...data.subarray(i, i + chunkSize));
  }
  const b64 = btoa(binary);
  localStorage.setItem(DB_KEY, b64);
}

// ---- CATEGORIES ----
export async function getCategories() {
  const database = await getDb();
  const results = database.exec('SELECT id, name, color, icon FROM categories ORDER BY sort_order, id');
  if (!results.length) return [];
  const [{ columns, values }] = results;
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]])) as {
      id: number;
      name: string;
      color: string;
      icon: string;
    }
  );
}

export async function addCategory(data: { name: string; color: string; icon: string }) {
  const database = await getDb();
  const maxRes = database.exec('SELECT COALESCE(MAX(sort_order), -1) FROM categories');
  const maxOrder = maxRes.length ? (maxRes[0].values[0][0] as number) : -1;
  const sortOrder = maxOrder + 1;
  database.run(
    'INSERT INTO categories (name, color, icon, sort_order) VALUES (?, ?, ?, ?)',
    [data.name, data.color, data.icon, sortOrder]
  );
  persistDb(database);
  const uid = getUserId();
  if (uid) {
    const idRes = database.exec('SELECT last_insert_rowid()');
    const id = idRes[0].values[0][0] as number;
    syncCategory(uid, id, { ...data, sort_order: sortOrder });
  }
}

export async function deleteCategory(id: number) {
  const database = await getDb();
  database.run('DELETE FROM transactions WHERE category_id = ?', [id]);
  database.run('DELETE FROM budgets WHERE category_id = ?', [id]);
  database.run('DELETE FROM categories WHERE id = ?', [id]);
  persistDb(database);
  const uid = getUserId();
  if (uid) syncDeleteCategory(uid, id);
}

export async function reorderCategories(orderedIds: number[]) {
  const database = await getDb();
  orderedIds.forEach((id, i) => {
    database.run('UPDATE categories SET sort_order = ? WHERE id = ?', [i, id]);
  });
  persistDb(database);
  const uid = getUserId();
  if (uid) syncCategoryReorder(uid, orderedIds);
}

// ---- TRANSACTIONS ----
export async function addTransaction(data: {
  category_id: number;
  amount: number;
  date: string;
  note?: string;
  document_id?: number;
  comment?: string;
}) {
  const database = await getDb();
  database.run(
    'INSERT INTO transactions (category_id, amount, date, note, document_id, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
    [data.category_id, data.amount, data.date, data.note || null, data.document_id || null, data.comment || null]
  );
  const idRes = database.exec('SELECT last_insert_rowid()');
  const id = idRes[0].values[0][0] as number;
  persistDb(database);
  const uid = getUserId();
  if (uid) {
    const created_at = new Date().toISOString();
    syncTransaction(uid, id, { category_id: data.category_id, amount: data.amount, date: data.date, note: data.note || null, created_at, document_id: data.document_id || null, comment: data.comment || null });
  }
}

export async function getTransactions(limit = 50) {
  const database = await getDb();
  const results = database.exec(`
    SELECT t.id, t.category_id, t.amount, t.date, t.note, t.created_at, t.document_id, t.comment,
           c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT ${limit}
  `);
  if (!results.length) return [];
  const [{ columns, values }] = results;
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  ) as unknown as Transaction[];
}

export async function getTransactionsByMonth(month: string) {
  const database = await getDb();
  const results = database.exec(`
    SELECT t.id, t.category_id, t.amount, t.date, t.note, t.created_at, t.document_id, t.comment,
           c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE substr(t.date, 1, 7) = '${month}'
    ORDER BY t.date DESC, t.created_at DESC
  `);
  if (!results.length) return [];
  const [{ columns, values }] = results;
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  ) as unknown as Transaction[];
}

export async function deleteTransaction(id: number) {
  const database = await getDb();
  database.run('DELETE FROM transactions WHERE id = ?', [id]);
  persistDb(database);
  const uid = getUserId();
  if (uid) syncDeleteTransaction(uid, id);
}

// ---- BUDGETS ----
export async function getBudgetsForMonth(month: string) {
  const database = await getDb();
  const results = database.exec(`
    SELECT b.id, b.category_id, b.month, b.amount,
           c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM budgets b
    JOIN categories c ON b.category_id = c.id
    WHERE b.month = '${month}'
  `);
  if (!results.length) return [];
  const [{ columns, values }] = results;
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  ) as unknown as Budget[];
}

export async function upsertBudget(category_id: number, month: string, amount: number) {
  const database = await getDb();
  const existing = database.exec(
    `SELECT id FROM budgets WHERE category_id = ${category_id} AND month = '${month}'`
  );
  let budgetId: number;
  if (existing.length && existing[0].values.length) {
    budgetId = existing[0].values[0][0] as number;
    database.run('UPDATE budgets SET amount = ? WHERE id = ?', [amount, budgetId]);
  } else {
    database.run('INSERT INTO budgets (category_id, month, amount) VALUES (?, ?, ?)', [
      category_id,
      month,
      amount,
    ]);
    const idRes = database.exec('SELECT last_insert_rowid()');
    budgetId = idRes[0].values[0][0] as number;
  }
  persistDb(database);
  const uid = getUserId();
  if (uid) syncBudget(uid, budgetId, { category_id, month, amount });
}

export async function getSpendingByCategory(month: string) {
  const database = await getDb();
  const results = database.exec(`
    SELECT c.id, c.name, c.color, c.icon,
           COALESCE(SUM(t.amount), 0) as spent,
           COALESCE(b.amount, 0) as budget
    FROM categories c
    LEFT JOIN transactions t ON t.category_id = c.id AND substr(t.date, 1, 7) = '${month}'
    LEFT JOIN budgets b ON b.category_id = c.id AND b.month = '${month}'
    GROUP BY c.id
    ORDER BY c.id
  `);
  if (!results.length) return [];
  const [{ columns, values }] = results;
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  ) as unknown as CategorySpending[];
}

export async function getMonthlyBudget(month: string): Promise<number | null> {
  const database = await getDb();
  const results = database.exec(`SELECT total_amount FROM monthly_budget WHERE month = '${month}'`);
  if (!results.length || !results[0].values.length) return null;
  return results[0].values[0][0] as number;
}

export async function upsertMonthlyBudget(month: string, amount: number) {
  const database = await getDb();
  const existing = database.exec(`SELECT id FROM monthly_budget WHERE month = '${month}'`);
  let mbId: number;
  if (existing.length && existing[0].values.length) {
    mbId = existing[0].values[0][0] as number;
    database.run('UPDATE monthly_budget SET total_amount = ? WHERE id = ?', [amount, mbId]);
  } else {
    database.run('INSERT INTO monthly_budget (month, total_amount) VALUES (?, ?)', [month, amount]);
    const idRes = database.exec('SELECT last_insert_rowid()');
    mbId = idRes[0].values[0][0] as number;
  }
  persistDb(database);
  const uid = getUserId();
  if (uid) syncMonthlyBudget(uid, mbId, { month, total_amount: amount });
}

export async function getUnallocatedBudget(month: string): Promise<number> {
  const [totalBudget, catSpending] = await Promise.all([
    getMonthlyBudget(month),
    getSpendingByCategory(month),
  ]);
  if (!totalBudget || totalBudget <= 0) return 0;
  const allocated = catSpending.reduce((s, c) => s + c.budget, 0);
  return Math.max(0, totalBudget - allocated);
}

// ---- DOCUMENTS ----
export interface Document {
  id: number;
  type: 'receipt' | 'statement';
  file_name: string;
  date: string;
  note: string | null;
  storage_path: string | null;
  local_path: string | null;
  mime_type: string;
  created_at: string;
}

const DOC_DATA_PREFIX = 'myser_doc_';

export async function saveDocumentData(id: number, base64: string) {
  const { idbSaveDoc } = await import('./doc-store');
  await idbSaveDoc(id, base64);
}

export async function getDocumentData(id: number): Promise<string | null> {
  // Try IndexedDB first
  try {
    const { idbGetDoc } = await import('./doc-store');
    const data = await idbGetDoc(id);
    if (data) return data;
  } catch { /* fall through */ }
  // Fall back to localStorage (legacy data from older versions)
  try {
    return localStorage.getItem(`${DOC_DATA_PREFIX}${id}`);
  } catch {
    return null;
  }
}

async function removeDocumentData(id: number) {
  try {
    const { idbDeleteDoc } = await import('./doc-store');
    await idbDeleteDoc(id);
  } catch { /* ignore */ }
  try { localStorage.removeItem(`${DOC_DATA_PREFIX}${id}`); } catch { /* ignore */ }
}

export async function addDocument(data: {
  type: 'receipt' | 'statement';
  file_name: string;
  date: string;
  note?: string;
  storage_path?: string;
  local_path?: string;
  mime_type: string;
  data_base64?: string;
}): Promise<number> {
  const database = await getDb();

  // Get next ID manually before insert
  const maxIdRes = database.exec('SELECT COALESCE(MAX(id), 0) FROM documents');
  const nextId = (maxIdRes.length ? (maxIdRes[0].values[0][0] as number) : 0) + 1;

  database.run(
    'INSERT INTO documents (id, type, file_name, date, note, storage_path, local_path, mime_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))',
    [nextId, data.type, data.file_name, data.date, data.note || null, data.storage_path || null, data.local_path || null, data.mime_type]
  );

  if (data.data_base64) {
    await saveDocumentData(nextId, data.data_base64);
  }

  persistDb(database);
  return nextId;
}

export async function getDocuments(type: 'receipt' | 'statement'): Promise<Document[]> {
  const database = await getDb();
  const results = database.exec(`SELECT id, type, file_name, date, note, storage_path, local_path, mime_type, created_at FROM documents WHERE type = '${type}' ORDER BY created_at DESC`);
  if (!results.length) return [];
  const [{ columns, values }] = results;
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  ) as unknown as Document[];
}

export async function getDocumentById(id: number): Promise<Document | null> {
  const database = await getDb();
  const results = database.exec(`SELECT id, type, file_name, date, note, storage_path, local_path, mime_type, created_at FROM documents WHERE id = ${id}`);
  if (!results.length || !results[0].values.length) return null;
  const [{ columns, values }] = results;
  return Object.fromEntries(columns.map((col, i) => [col, values[0][i]])) as unknown as Document;
}

export async function deleteDocument(id: number) {
  const database = await getDb();
  database.run('DELETE FROM documents WHERE id = ?', [id]);
  persistDb(database);
  removeDocumentData(id);
}

// ---- MERCHANT MEMORY ----
function normalizeMerchant(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

export async function saveMerchantMemory(merchant: string, categoryId: number) {
  const key = normalizeMerchant(merchant);
  if (!key || key.length < 2) return;
  const database = await getDb();
  const existing = database.exec(`SELECT id, times_seen FROM merchant_memory WHERE merchant_key = '${key}'`);
  if (existing.length && existing[0].values.length) {
    const id = existing[0].values[0][0] as number;
    const times = existing[0].values[0][1] as number;
    database.run('UPDATE merchant_memory SET category_id = ?, merchant_display = ?, times_seen = ?, last_seen = datetime("now") WHERE id = ?',
      [categoryId, merchant, times + 1, id]);
  } else {
    database.run('INSERT INTO merchant_memory (merchant_key, merchant_display, category_id) VALUES (?, ?, ?)',
      [key, merchant, categoryId]);
  }
  persistDb(database);

  // Contribute to global pool (async, fire-and-forget)
  const catResult = database.exec(`SELECT name FROM categories WHERE id = ${categoryId}`);
  if (catResult.length && catResult[0].values.length) {
    const categoryName = catResult[0].values[0][0] as string;
    import('./firestore-sync').then(({ contributeToGlobalPool }) => {
      contributeToGlobalPool(merchant, categoryName).catch(() => {});
    }).catch(() => {});
  }
}

export async function lookupMerchantCategory(merchant: string): Promise<{ categoryId: number; confidence: number } | null> {
  const key = normalizeMerchant(merchant);
  if (!key || key.length < 2) return null;
  const database = await getDb();

  // Exact match
  const exact = database.exec(`SELECT category_id, times_seen FROM merchant_memory WHERE merchant_key = '${key}'`);
  if (exact.length && exact[0].values.length) {
    return { categoryId: exact[0].values[0][0] as number, confidence: exact[0].values[0][1] as number };
  }

  // Fuzzy match — check if any stored key is contained in this merchant or vice versa
  const all = database.exec('SELECT merchant_key, category_id, times_seen FROM merchant_memory');
  if (all.length) {
    for (const row of all[0].values) {
      const storedKey = row[0] as string;
      const catId = row[1] as number;
      const times = row[2] as number;
      if (key.includes(storedKey) || storedKey.includes(key)) {
        return { categoryId: catId, confidence: times };
      }
    }
  }

  return null;
}

// ---- PENDING LOGS ----
export interface PendingLog {
  id: string;
  document_id: number;
  merchant: string;
  amount: number;
  category_id: number;
  date: string;
  raw_ocr_text: string;
  status: string;
  created_at: string;
}

export async function addPendingLog(data: {
  id: string;
  document_id: number;
  merchant: string;
  amount: number;
  category_id: number;
  date: string;
  raw_ocr_text: string;
}) {
  const database = await getDb();
  database.run(
    'INSERT INTO pending_logs (id, document_id, merchant, amount, category_id, date, raw_ocr_text, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))',
    [data.id, data.document_id, data.merchant, data.amount, data.category_id, data.date, data.raw_ocr_text, 'pending']
  );
  persistDb(database);
}

export async function getPendingLogs(): Promise<PendingLog[]> {
  const database = await getDb();
  const results = database.exec("SELECT id, document_id, merchant, amount, category_id, date, raw_ocr_text, status, created_at FROM pending_logs WHERE status = 'pending' ORDER BY created_at DESC");
  if (!results.length) return [];
  const [{ columns, values }] = results;
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  ) as unknown as PendingLog[];
}

export async function getPendingLogCount(): Promise<number> {
  const database = await getDb();
  const results = database.exec("SELECT COUNT(*) FROM pending_logs WHERE status = 'pending'");
  if (!results.length) return 0;
  return results[0].values[0][0] as number;
}

export async function deletePendingLog(id: string) {
  const database = await getDb();
  database.run('DELETE FROM pending_logs WHERE id = ?', [id]);
  persistDb(database);
}

export async function updateDocumentFileName(docId: number, newName: string) {
  const database = await getDb();
  database.run('UPDATE documents SET file_name = ? WHERE id = ?', [newName, docId]);
  persistDb(database);
}

// ---- ANALYTICS ----
export async function getMonthlyTotals(months: string[]): Promise<{ month: string; total: number }[]> {
  const database = await getDb();
  const results: { month: string; total: number }[] = [];
  for (const m of months) {
    const res = database.exec(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE substr(date, 1, 7) = '${m}'`
    );
    results.push({ month: m, total: res.length ? (res[0].values[0][0] as number) : 0 });
  }
  return results;
}

export async function getDailySpending(month: string): Promise<{ day: number; total: number }[]> {
  const database = await getDb();
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const results: { day: number; total: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    const res = database.exec(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE date = '${dateStr}'`
    );
    results.push({ day: d, total: res.length ? (res[0].values[0][0] as number) : 0 });
  }
  return results;
}

// ---- TYPES ----
export interface Transaction {
  id: number;
  category_id: number;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  document_id: number | null;
  comment: string | null;
}

export interface Budget {
  id: number;
  category_id: number;
  month: string;
  amount: number;
  category_name: string;
  category_color: string;
  category_icon: string;
}

export interface CategorySpending {
  id: number;
  name: string;
  color: string;
  icon: string;
  spent: number;
  budget: number;
}
