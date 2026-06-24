import {
  collection, doc, setDoc, getDocs, deleteDoc, writeBatch, getDoc, increment,
} from 'firebase/firestore';
import { ref, uploadString, deleteObject, getDownloadURL } from 'firebase/storage';
import { db as firestore, storage } from './firebase';
import { getDb, persistDb, saveDocumentData } from './db';

const SYNC_KEY = 'myser_sync_enabled';

export function isSyncEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SYNC_KEY) === 'true';
}

export function setSyncEnabled(enabled: boolean) {
  localStorage.setItem(SYNC_KEY, enabled ? 'true' : 'false');
}

function userPath(userId: string) {
  return `users/${userId}`;
}

export async function hasCloudData(userId: string): Promise<boolean> {
  const snap = await getDocs(collection(firestore, `${userPath(userId)}/categories`));
  return !snap.empty;
}

export async function uploadAllData(userId: string) {
  const database = await getDb();

  const cats = database.exec('SELECT id, name, color, icon, sort_order FROM categories');
  if (cats.length) {
    const batch = writeBatch(firestore);
    for (const row of cats[0].values) {
      const [id, name, color, icon, sort_order] = row;
      batch.set(doc(firestore, `${userPath(userId)}/categories`, String(id)), {
        id, name, color, icon, sort_order,
      });
    }
    await batch.commit();
  }

  const txs = database.exec('SELECT id, category_id, amount, date, note, created_at, document_id, comment FROM transactions');
  if (txs.length) {
    const batchSize = 450;
    for (let i = 0; i < txs[0].values.length; i += batchSize) {
      const batch = writeBatch(firestore);
      const chunk = txs[0].values.slice(i, i + batchSize);
      for (const row of chunk) {
        const [id, category_id, amount, date, note, created_at, document_id, comment] = row;
        batch.set(doc(firestore, `${userPath(userId)}/transactions`, String(id)), {
          id, category_id, amount, date, note, created_at, document_id: document_id || null, comment: comment || null,
        });
      }
      await batch.commit();
    }
  }

  const budgets = database.exec('SELECT id, category_id, month, amount FROM budgets');
  if (budgets.length) {
    const batch = writeBatch(firestore);
    for (const row of budgets[0].values) {
      const [id, category_id, month, amount] = row;
      batch.set(doc(firestore, `${userPath(userId)}/budgets`, String(id)), {
        id, category_id, month, amount,
      });
    }
    await batch.commit();
  }

  const monthly = database.exec('SELECT id, month, total_amount FROM monthly_budget');
  if (monthly.length) {
    const batch = writeBatch(firestore);
    for (const row of monthly[0].values) {
      const [id, month, total_amount] = row;
      batch.set(doc(firestore, `${userPath(userId)}/monthly_budget`, String(id)), {
        id, month, total_amount,
      });
    }
    await batch.commit();
  }
}

export async function pullFromCloud(userId: string) {
  const database = await getDb();

  database.run('DELETE FROM transactions');
  database.run('DELETE FROM budgets');
  database.run('DELETE FROM monthly_budget');
  database.run('DELETE FROM categories');

  const catsSnap = await getDocs(collection(firestore, `${userPath(userId)}/categories`));
  for (const d of catsSnap.docs) {
    const c = d.data();
    database.run(
      'INSERT OR REPLACE INTO categories (id, name, color, icon, sort_order) VALUES (?, ?, ?, ?, ?)',
      [c.id, c.name, c.color, c.icon, c.sort_order || 0]
    );
  }

  const txSnap = await getDocs(collection(firestore, `${userPath(userId)}/transactions`));
  for (const d of txSnap.docs) {
    const t = d.data();
    database.run(
      'INSERT OR REPLACE INTO transactions (id, category_id, amount, date, note, created_at, document_id, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [t.id, t.category_id, t.amount, t.date, t.note || null, t.created_at, t.document_id || null, t.comment || null]
    );
  }

  const budSnap = await getDocs(collection(firestore, `${userPath(userId)}/budgets`));
  for (const d of budSnap.docs) {
    const b = d.data();
    database.run(
      'INSERT OR REPLACE INTO budgets (id, category_id, month, amount) VALUES (?, ?, ?, ?)',
      [b.id, b.category_id, b.month, b.amount]
    );
  }

  const monSnap = await getDocs(collection(firestore, `${userPath(userId)}/monthly_budget`));
  for (const d of monSnap.docs) {
    const m = d.data();
    database.run(
      'INSERT OR REPLACE INTO monthly_budget (id, month, total_amount) VALUES (?, ?, ?)',
      [m.id, m.month, m.total_amount]
    );
  }

  persistDb(database);
}

// Sync individual writes
export async function syncCategory(userId: string, id: number, data: { name: string; color: string; icon: string; sort_order: number }) {
  if (!isSyncEnabled()) return;
  await setDoc(doc(firestore, `${userPath(userId)}/categories`, String(id)), { id, ...data });
}

export async function syncDeleteCategory(userId: string, id: number) {
  if (!isSyncEnabled()) return;
  await deleteDoc(doc(firestore, `${userPath(userId)}/categories`, String(id)));
}

export async function syncTransaction(userId: string, id: number, data: { category_id: number; amount: number; date: string; note: string | null; created_at: string; document_id?: number | null; comment?: string | null }) {
  if (!isSyncEnabled()) return;
  await setDoc(doc(firestore, `${userPath(userId)}/transactions`, String(id)), { id, ...data });
}

export async function syncDeleteTransaction(userId: string, id: number) {
  if (!isSyncEnabled()) return;
  await deleteDoc(doc(firestore, `${userPath(userId)}/transactions`, String(id)));
}

export async function syncBudget(userId: string, id: number, data: { category_id: number; month: string; amount: number }) {
  if (!isSyncEnabled()) return;
  await setDoc(doc(firestore, `${userPath(userId)}/budgets`, String(id)), { id, ...data });
}

export async function syncMonthlyBudget(userId: string, id: number, data: { month: string; total_amount: number }) {
  if (!isSyncEnabled()) return;
  await setDoc(doc(firestore, `${userPath(userId)}/monthly_budget`, String(id)), { id, ...data });
}

export async function syncCategoryReorder(userId: string, orderedIds: number[]) {
  if (!isSyncEnabled()) return;
  const batch = writeBatch(firestore);
  orderedIds.forEach((id, i) => {
    batch.update(doc(firestore, `${userPath(userId)}/categories`, String(id)), { sort_order: i });
  });
  await batch.commit();
}

// ---- DOCUMENT SYNC ----
export async function syncDocumentUpload(
  userId: string,
  docId: number,
  meta: { type: string; file_name: string; date: string; note: string | null; mime_type: string; created_at: string },
  base64Data: string
): Promise<string> {
  if (!isSyncEnabled()) return '';
  const storagePath = `users/${userId}/documents/${docId}_${meta.file_name}`;
  const storageRef = ref(storage, storagePath);
  await uploadString(storageRef, base64Data, 'base64', { contentType: meta.mime_type });
  await setDoc(doc(firestore, `${userPath(userId)}/documents`, String(docId)), {
    id: docId,
    ...meta,
    storage_path: storagePath,
  });
  return storagePath;
}

export async function syncDocumentDelete(userId: string, docId: number, storagePath: string | null) {
  if (!isSyncEnabled()) return;
  if (storagePath) {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch {
      // file may not exist in storage
    }
  }
  await deleteDoc(doc(firestore, `${userPath(userId)}/documents`, String(docId)));
}

export async function pullDocumentsFromCloud(userId: string) {
  const database = await getDb();
  const docsSnap = await getDocs(collection(firestore, `${userPath(userId)}/documents`));
  for (const d of docsSnap.docs) {
    const data = d.data();
    database.run(
      'INSERT OR REPLACE INTO documents (id, type, file_name, date, note, storage_path, local_path, mime_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [data.id, data.type, data.file_name, data.date, data.note || null, data.storage_path || null, null, data.mime_type, data.created_at]
    );
    if (data.storage_path) {
      try {
        const url = await getDownloadURL(ref(storage, data.storage_path));
        const response = await fetch(url);
        const blob = await response.blob();
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(blob);
        });
        saveDocumentData(data.id, base64);
      } catch {
        // download failed, file viewable only when online
      }
    }
  }
  persistDb(database);
}

// ---- GLOBAL MERCHANT POOL ----
function normalizeMerchantKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function contributeToGlobalPool(merchant: string, categoryName: string) {
  const key = normalizeMerchantKey(merchant);
  if (!key || key.length < 2) return;

  try {
    const ref = doc(firestore, 'global_merchant_data', key);
    const existing = await getDoc(ref);

    if (existing.exists()) {
      const data = existing.data();
      const votes = data.category_votes || {};
      votes[categoryName] = (votes[categoryName] || 0) + 1;

      await setDoc(ref, {
        merchant_display: merchant,
        category_votes: votes,
        times_confirmed: increment(1),
        last_confirmed: new Date().toISOString(),
      }, { merge: true });
    } else {
      await setDoc(ref, {
        merchant_display: merchant,
        category_votes: { [categoryName]: 1 },
        times_confirmed: 1,
        last_confirmed: new Date().toISOString(),
      });
    }
  } catch {
    // Offline or Firestore error — local memory still works
  }
}

export async function pullGlobalDictionary(): Promise<Array<{ merchant: string; categoryName: string; confidence: number }>> {
  try {
    const snap = await getDocs(collection(firestore, 'global_merchant_data'));
    const results: Array<{ merchant: string; categoryName: string; confidence: number }> = [];

    for (const d of snap.docs) {
      const data = d.data();
      const votes = data.category_votes || {};
      let topCategory = '';
      let topVotes = 0;
      for (const [cat, count] of Object.entries(votes)) {
        if ((count as number) > topVotes) {
          topCategory = cat;
          topVotes = count as number;
        }
      }
      if (topCategory && topVotes >= 1) {
        results.push({
          merchant: data.merchant_display || d.id,
          categoryName: topCategory,
          confidence: topVotes,
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}
