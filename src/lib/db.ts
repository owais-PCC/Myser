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

export async function wipeLocalData() {
  const database = await getDb();
  database.run('DELETE FROM transactions');
  database.run('DELETE FROM budgets');
  database.run('DELETE FROM monthly_budget');
  database.run('DELETE FROM documents');
  database.run('DELETE FROM pending_logs');
  database.run('DELETE FROM merchant_memory');
  database.run('DELETE FROM categories');
  // Restore the full starter set, not just the original ten — a wipe that
  // silently downgraded the user to a coarser category list than a fresh
  // install gets would be its own surprise. Clearing the seeded-once flag
  // lets the extra-expense seeding run again for this now-empty table.
  seedCategories(database);
  seedIncomeCategories(database);
  if (typeof window !== 'undefined') localStorage.removeItem(EXTRA_CATEGORIES_SEEDED_KEY);
  seedAdditionalExpenseCategories(database);
  persistDb(database);
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

// Finer-grained expense categories added after v1. These exist mainly so
// itemized receipt splitting (MYS-9) has somewhere accurate to put each
// line item — the AI is told to pick from the user's real category list,
// so a coarse list ("Food" for everything edible) directly caps how good
// the labelling can be. Splitting groceries/snacks/eating-out/self-care/
// household apart is what lets one supermarket receipt fan out sensibly.
//
// IDs start at 201 deliberately. Expense defaults occupy 1-10, income
// defaults 101-106, and USER-created categories are AUTOINCREMENT from 11
// upward — real accounts already have categories at 11-16, so anything in
// that range would collide with data that already exists.
export const ADDITIONAL_EXPENSE_CATEGORIES = [
  { id: 201, name: 'Groceries', color: '#6AB04C', icon: '🛒' },
  { id: 202, name: 'Snacks', color: '#F0932B', icon: '🍿' },
  { id: 203, name: 'Eating Out', color: '#EB4D4B', icon: '🍽️' },
  { id: 204, name: 'Self Care', color: '#E056FD', icon: '🧴' },
  { id: 205, name: 'Household', color: '#22A6B3', icon: '🧼' },
  { id: 206, name: 'Rent', color: '#7ED6DF', icon: '🏠' },
  { id: 207, name: 'Subscriptions', color: '#686DE0', icon: '🔁' },
  { id: 208, name: 'Travel', color: '#4834D4', icon: '✈️' },
  { id: 209, name: 'Gifts', color: '#FF7979', icon: '🎁' },
];

// IDs start at 101 to stay clear of both the fixed expense category ids
// above (1-10) and any user-created categories (AUTOINCREMENT, so those
// start at 11+).
export const DEFAULT_INCOME_CATEGORIES = [
  { id: 101, name: 'Salary', color: '#047857', icon: '💼' },
  { id: 102, name: 'Business', color: '#00B894', icon: '🏪' },
  { id: 103, name: 'Freelance', color: '#4ECDC4', icon: '💻' },
  { id: 104, name: 'Investments', color: '#FDCB6E', icon: '📈' },
  { id: 105, name: 'Gifts & Refunds', color: '#FD79A8', icon: '🎁' },
  { id: 106, name: 'Other Income', color: '#74B9FF', icon: '➕' },
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

    -- No longer written to or read by the app. Receipts used to be queued
    -- here by OCR before the user confirmed them (surfaced via a
    -- notification bell), which meant one receipt could be recorded twice:
    -- once as the auto-queued row and again on Save. Receipts are now held
    -- in memory until Save, so nothing populates this table.
    -- Kept (rather than dropped) purely so existing installs that still
    -- have un-reviewed rows don't have that data destroyed by an upgrade;
    -- safe to remove in a later migration once that no longer matters.
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

  // Income tracking (MYS-8) + recurring expenses (MYS-11)
  try { database.run("ALTER TABLE categories ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'"); } catch { /* exists */ }
  try { database.run("ALTER TABLE transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'"); } catch { /* exists */ }
  try { database.run('ALTER TABLE transactions ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0'); } catch { /* exists */ }
  try { database.run('ALTER TABLE transactions ADD COLUMN auto_repeat INTEGER NOT NULL DEFAULT 0'); } catch { /* exists */ }
  try { database.run('ALTER TABLE transactions ADD COLUMN recurrence_interval TEXT'); } catch { /* exists */ }
  try { database.run('ALTER TABLE transactions ADD COLUMN next_occurrence_date TEXT'); } catch { /* exists */ }

  // Itemized receipts + tax capture (MYS-9). line_items is a JSON array
  // (ReceiptLineItem[], see itemized-scan.ts) recording what made up this
  // specific transaction when it came from a split receipt — null/absent
  // for every ordinary transaction. tax_amount is the GST/VAT/sales-tax
  // line captured off the receipt, separate from the item total.
  try { database.run('ALTER TABLE transactions ADD COLUMN line_items TEXT'); } catch { /* exists */ }
  try { database.run('ALTER TABLE transactions ADD COLUMN tax_amount REAL'); } catch { /* exists */ }

  // Seed starter income categories once — covers both brand-new installs
  // (this runs as part of initSchema before the explicit seedCategories()
  // call in getDb()) and existing installs upgrading into this feature.
  try {
    const countRes = database.exec("SELECT COUNT(*) FROM categories WHERE type = 'income'");
    const count = countRes.length ? (countRes[0].values[0][0] as number) : 0;
    if (count === 0) seedIncomeCategories(database);
  } catch {
    // ignore
  }

  seedAdditionalExpenseCategories(database);
}

// Marks the finer-grained expense categories as already offered, so they're
// added exactly once. Without this the seeding below would re-run on every
// app load and resurrect any of these categories the user deliberately
// deleted — deleting "Pets" only to have it reappear next launch would be
// its own bug. Lives in localStorage alongside the database itself
// (DB_KEY), so the flag and the data it describes share a lifetime.
const EXTRA_CATEGORIES_SEEDED_KEY = 'myser_extra_expense_categories_seeded_v1';

function seedAdditionalExpenseCategories(database: Database) {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(EXTRA_CATEGORIES_SEEDED_KEY) === 'true') return;

  try {
    // Skip any name the user already has. Someone may well have created
    // their own "Groceries" by hand, and seeding a second one would leave
    // them with a confusing duplicate pair. Compared case-insensitively so
    // "groceries" also counts as already present.
    const existingNames = new Set<string>();
    const res = database.exec('SELECT name FROM categories');
    if (res.length) {
      for (const row of res[0].values) existingNames.add(String(row[0]).trim().toLowerCase());
    }

    const stmt = database.prepare(
      "INSERT INTO categories (id, name, color, icon, type, sort_order) VALUES (?, ?, ?, ?, 'expense', ?)"
    );
    let inserted = 0;
    for (const cat of ADDITIONAL_EXPENSE_CATEGORIES) {
      if (existingNames.has(cat.name.toLowerCase())) continue;
      try {
        // sort_order = id keeps these after the originals (whose
        // sort_order values are small) without disturbing user ordering.
        stmt.run([cat.id, cat.name, cat.color, cat.icon, cat.id]);
        inserted++;
      } catch {
        // id somehow taken — skip rather than abort the whole batch
      }
    }
    stmt.free();

    localStorage.setItem(EXTRA_CATEGORIES_SEEDED_KEY, 'true');

    // getDb() only persists on the fresh-install path, so an upgrade would
    // otherwise keep these in memory until some unrelated write happened
    // to flush the database.
    if (inserted > 0) persistDb(database);
  } catch {
    // Never let category seeding break app startup.
  }
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

function seedIncomeCategories(database: Database) {
  const stmt = database.prepare(
    "INSERT INTO categories (id, name, color, icon, type) VALUES (?, ?, ?, ?, 'income')"
  );
  for (const cat of DEFAULT_INCOME_CATEGORIES) {
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
export async function getCategories(type: 'expense' | 'income' = 'expense') {
  const database = await getDb();
  const results = database.exec(`SELECT id, name, color, icon FROM categories WHERE type = '${type}' ORDER BY sort_order, id`);
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

/** Returns the id of the newly created category. */
export async function addCategory(data: { name: string; color: string; icon: string; type?: 'expense' | 'income' }): Promise<number> {
  const database = await getDb();
  const type = data.type || 'expense';
  const maxRes = database.exec(`SELECT COALESCE(MAX(sort_order), -1) FROM categories WHERE type = '${type}'`);
  const maxOrder = maxRes.length ? (maxRes[0].values[0][0] as number) : -1;
  const sortOrder = maxOrder + 1;
  database.run(
    'INSERT INTO categories (name, color, icon, sort_order, type) VALUES (?, ?, ?, ?, ?)',
    [data.name, data.color, data.icon, sortOrder, type]
  );
  const idRes = database.exec('SELECT last_insert_rowid()');
  const id = idRes[0].values[0][0] as number;
  persistDb(database);
  const uid = getUserId();
  if (uid) {
    syncCategory(uid, id, { name: data.name, color: data.color, icon: data.icon, sort_order: sortOrder, type });
  }
  return id;
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

// v1 of auto-repeat only supports monthly, but the interval is stored as
// text so weekly/yearly can be added later without another migration.
function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1 + months, d);
  return date.toISOString().slice(0, 10);
}

export async function addTransaction(data: {
  category_id: number;
  amount: number;
  date: string;
  note?: string;
  document_id?: number;
  comment?: string;
  type?: 'expense' | 'income';
  is_recurring?: boolean;
  auto_repeat?: boolean;
  recurrence_interval?: 'monthly';
  line_items?: string; // JSON ReceiptLineItem[] — see itemized-scan.ts
  tax_amount?: number;
}) {
  const database = await getDb();
  const type = data.type || 'expense';
  const isRecurring = data.is_recurring ? 1 : 0;
  const autoRepeat = data.auto_repeat ? 1 : 0;
  const interval = data.auto_repeat ? (data.recurrence_interval || 'monthly') : null;
  const nextOccurrence = data.auto_repeat ? addMonths(data.date, 1) : null;

  database.run(
    'INSERT INTO transactions (category_id, amount, date, note, document_id, comment, type, is_recurring, auto_repeat, recurrence_interval, next_occurrence_date, line_items, tax_amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))',
    [data.category_id, data.amount, data.date, data.note || null, data.document_id || null, data.comment || null, type, isRecurring, autoRepeat, interval, nextOccurrence, data.line_items || null, data.tax_amount ?? null]
  );
  const idRes = database.exec('SELECT last_insert_rowid()');
  const id = idRes[0].values[0][0] as number;
  persistDb(database);
  const uid = getUserId();
  if (uid) {
    const created_at = new Date().toISOString();
    syncTransaction(uid, id, {
      category_id: data.category_id, amount: data.amount, date: data.date, note: data.note || null, created_at,
      document_id: data.document_id || null, comment: data.comment || null, type,
      is_recurring: !!data.is_recurring, auto_repeat: !!data.auto_repeat, recurrence_interval: interval, next_occurrence_date: nextOccurrence,
      line_items: data.line_items || null, tax_amount: data.tax_amount ?? null,
    });
  }
}

// Catches up any auto-repeat transactions whose next occurrence date has
// passed. No server/background scheduler exists (or is in scope for v1),
// so this runs once on app open instead — see MYS-11 in TICKETS.md. Only
// the "anchor" transaction of each series (auto_repeat = 1) carries
// next_occurrence_date; spawned occurrences are inserted with
// auto_repeat = 0 so they don't themselves keep spawning more (which would
// otherwise multiply every catch-up run).
export async function runRecurringCatchUp(): Promise<number> {
  const database = await getDb();
  const todayStr = new Date().toISOString().slice(0, 10);
  const due = database.exec(
    `SELECT id, category_id, amount, note, document_id, comment, type
     FROM transactions
     WHERE auto_repeat = 1 AND next_occurrence_date IS NOT NULL AND next_occurrence_date <= '${todayStr}'`
  );
  if (!due.length) return 0;

  let posted = 0;
  const { columns, values } = due[0];
  for (const row of values) {
    const rec = Object.fromEntries(columns.map((c, i) => [c, row[i]])) as {
      id: number; category_id: number; amount: number; note: string | null;
      document_id: number | null; comment: string | null; type: string;
    };

    // Re-read the anchor's current next_occurrence_date fresh each loop —
    // guards against staleness if this ever runs concurrently.
    const anchorRes = database.exec(`SELECT next_occurrence_date FROM transactions WHERE id = ${rec.id}`);
    if (!anchorRes.length || !anchorRes[0].values.length) continue;
    let occurrenceDate = anchorRes[0].values[0][0] as string;

    // Cap catch-up per series so a very long-unopened app doesn't try to
    // backfill an unbounded number of months in one go.
    let guard = 0;
    while (occurrenceDate <= todayStr && guard < 24) {
      database.run(
        'INSERT INTO transactions (category_id, amount, date, note, document_id, comment, type, is_recurring, auto_repeat, recurrence_interval, next_occurrence_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, NULL, NULL, datetime("now"))',
        [rec.category_id, rec.amount, occurrenceDate, rec.note, rec.document_id, rec.comment, rec.type]
      );
      posted++;
      occurrenceDate = addMonths(occurrenceDate, 1);
      guard++;
    }
    database.run('UPDATE transactions SET next_occurrence_date = ? WHERE id = ?', [occurrenceDate, rec.id]);
  }

  if (posted > 0) persistDb(database);
  return posted;
}

export async function getTransactions(limit = 50, month?: string, type: 'expense' | 'income' = 'expense') {
  const database = await getDb();
  const monthFilter = month ? `AND t.date LIKE '${month}%'` : '';
  const results = database.exec(`
    SELECT t.id, t.category_id, t.amount, t.date, t.note, t.created_at, t.document_id, t.comment,
           t.type, t.is_recurring, t.auto_repeat, t.line_items, t.tax_amount,
           c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.type = '${type}' ${monthFilter}
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT ${limit}
  `);
  if (!results.length) return [];
  const [{ columns, values }] = results;
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  ) as unknown as Transaction[];
}

export async function getTransactionsByMonth(
  month: string,
  options: { type?: 'expense' | 'income'; excludeRecurring?: boolean } = {}
) {
  const { type = 'expense', excludeRecurring = false } = options;
  const database = await getDb();
  const recurringFilter = excludeRecurring ? 'AND t.is_recurring = 0' : '';
  const results = database.exec(`
    SELECT t.id, t.category_id, t.amount, t.date, t.note, t.created_at, t.document_id, t.comment,
           t.type, t.is_recurring, t.auto_repeat, t.line_items, t.tax_amount,
           c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE substr(t.date, 1, 7) = '${month}' AND t.type = '${type}' ${recurringFilter}
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

export async function updateTransaction(id: number, data: {
  category_id: number;
  amount: number;
  date: string;
  note?: string;
  comment?: string | null;
  is_recurring?: boolean;
}) {
  const database = await getDb();
  // is_recurring is optional here — if the caller doesn't know about it
  // (e.g. an older edit form), preserve whatever is already stored rather
  // than silently clearing the flag.
  let isRecurring: number;
  if (data.is_recurring !== undefined) {
    isRecurring = data.is_recurring ? 1 : 0;
  } else {
    const existing = database.exec(`SELECT is_recurring FROM transactions WHERE id = ${id}`);
    isRecurring = existing.length && existing[0].values.length ? (existing[0].values[0][0] as number) : 0;
  }
  // Editing only ever affects this single row, per MYS-11's v1 scope — if
  // this happens to be an auto-repeat anchor, its schedule/
  // next_occurrence_date is left untouched so the series keeps running.
  database.run(
    'UPDATE transactions SET category_id = ?, amount = ?, date = ?, note = ?, comment = ?, is_recurring = ? WHERE id = ?',
    [data.category_id, data.amount, data.date, data.note || null, data.comment || null, isRecurring, id]
  );
  persistDb(database);
  const uid = getUserId();
  if (uid) {
    const txRes = database.exec(`SELECT created_at, document_id, type, auto_repeat, recurrence_interval, next_occurrence_date FROM transactions WHERE id = ${id}`);
    if (txRes.length && txRes[0].values.length) {
      const [created_at, document_id, type, auto_repeat, recurrence_interval, next_occurrence_date] = txRes[0].values[0] as [string, number | null, string, number, string | null, string | null];
      syncTransaction(uid, id, {
        category_id: data.category_id,
        amount: data.amount,
        date: data.date,
        note: data.note || null,
        created_at,
        document_id,
        comment: data.comment || null,
        type,
        is_recurring: !!isRecurring,
        auto_repeat: !!auto_repeat,
        recurrence_interval,
        next_occurrence_date,
      });
    }
  }
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

export async function getSpendingByCategory(month: string, options: { excludeRecurring?: boolean } = {}) {
  const database = await getDb();
  const recurringFilter = options.excludeRecurring ? 'AND t.is_recurring = 0' : '';
  const results = database.exec(`
    SELECT c.id, c.name, c.color, c.icon,
           COALESCE(SUM(t.amount), 0) as spent,
           COALESCE(b.amount, 0) as budget
    FROM categories c
    LEFT JOIN transactions t ON t.category_id = c.id AND substr(t.date, 1, 7) = '${month}' AND t.type = 'expense' ${recurringFilter}
    LEFT JOIN budgets b ON b.category_id = c.id AND b.month = '${month}'
    WHERE c.type = 'expense'
    GROUP BY c.id
    ORDER BY c.id
  `);
  if (!results.length) return [];
  const [{ columns, values }] = results;
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  ) as unknown as CategorySpending[];
}

export async function getIncomeByCategory(month: string): Promise<{ id: number; name: string; color: string; icon: string; received: number }[]> {
  const database = await getDb();
  const results = database.exec(`
    SELECT c.id, c.name, c.color, c.icon,
           COALESCE(SUM(t.amount), 0) as received
    FROM categories c
    LEFT JOIN transactions t ON t.category_id = c.id AND substr(t.date, 1, 7) = '${month}' AND t.type = 'income'
    WHERE c.type = 'income'
    GROUP BY c.id
    ORDER BY c.id
  `);
  if (!results.length) return [];
  const [{ columns, values }] = results;
  return values.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  ) as unknown as { id: number; name: string; color: string; icon: string; received: number }[];
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

export async function updateDocumentFileName(docId: number, newName: string) {
  const database = await getDb();
  database.run('UPDATE documents SET file_name = ? WHERE id = ?', [newName, docId]);
  persistDb(database);
}

// ---- ANALYTICS ----
export async function getMonthlyTotals(months: string[], options: { excludeRecurring?: boolean } = {}): Promise<{ month: string; total: number }[]> {
  const database = await getDb();
  const recurringFilter = options.excludeRecurring ? 'AND is_recurring = 0' : '';
  const results: { month: string; total: number }[] = [];
  for (const m of months) {
    const res = database.exec(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE substr(date, 1, 7) = '${m}' AND type = 'expense' ${recurringFilter}`
    );
    results.push({ month: m, total: res.length ? (res[0].values[0][0] as number) : 0 });
  }
  return results;
}

export async function getDailySpending(month: string, options: { excludeRecurring?: boolean } = {}): Promise<{ day: number; total: number }[]> {
  const database = await getDb();
  const recurringFilter = options.excludeRecurring ? 'AND is_recurring = 0' : '';
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const results: { day: number; total: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    const res = database.exec(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE date = '${dateStr}' AND type = 'expense' ${recurringFilter}`
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
  type: 'expense' | 'income';
  is_recurring: number;
  auto_repeat: number;
  // JSON-encoded ReceiptLineItem[] (see itemized-scan.ts) when this
  // transaction is one category-group split off a multi-item receipt scan
  // (MYS-9) — null for every ordinary transaction.
  line_items: string | null;
  tax_amount: number | null;
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
