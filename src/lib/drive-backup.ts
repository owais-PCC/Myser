import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithCredential } from 'firebase/auth';
import { getDocuments, getDocumentData, addDocument, saveDocumentData, getDb, persistDb } from './db';

const FOLDER_NAME = 'Myser Receipts';
const BACKUP_KEY = 'myser_last_drive_backup';
const TOKEN_KEY = 'myser_drive_token';
const TOKEN_EXPIRY_KEY = 'myser_drive_token_expiry';
const MANIFEST_NAME = 'myser-manifest.json';

function isNativePlatform(): boolean {
  try {
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function getCachedToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (token && expiry && Date.now() < parseInt(expiry)) {
    return token;
  }
  return null;
}

function cacheToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  // Cache for 50 minutes (Google tokens last ~60 min)
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + 50 * 60 * 1000));
}

async function getAccessToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;

  // Return cached token if still valid
  const cached = getCachedToken();
  if (cached) {
    // Quick validation — check if it still works
    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { Authorization: `Bearer ${cached}` },
      });
      if (res.ok) return cached;
    } catch { /* token expired, get fresh one */ }
  }

  // Get fresh token
  let token: string | null = null;

  if (isNativePlatform()) {
    try {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const result = await FirebaseAuthentication.signInWithGoogle({
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
      if (result.credential?.accessToken) {
        const credential = GoogleAuthProvider.credential(result.credential.idToken);
        await signInWithCredential(auth, credential);
        token = result.credential.accessToken;
      }
    } catch {
      return null;
    }
  } else {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      token = credential?.accessToken || null;
    } catch {
      return null;
    }
  }

  if (token) cacheToken(token);
  return token;
}

async function findOrCreateFolder(token: string): Promise<string> {
  // Search for existing folder
  try {
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files?.length > 0) return searchData.files[0].id;
    }
  } catch { /* search failed, try creating */ }

  // Create new folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Drive folder creation failed (${createRes.status}): ${err}`);
  }

  const createData = await createRes.json();
  if (!createData.id) throw new Error('Drive returned no folder ID');
  return createData.id;
}

async function uploadFileToDrive(token: string, folderId: string, fileName: string, mimeType: string, content: string, isBase64 = true): Promise<string | null> {
  const metadata = { name: fileName, parents: [folderId] };
  const boundary = '---myser-boundary---';

  const body = isBase64
    ? `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${content}\r\n--${boundary}--`
    : `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`;

  try {
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    if (res.ok) {
      const data = await res.json();
      return data.id;
    }
    return null;
  } catch {
    return null;
  }
}

async function deleteFileFromDrive(token: string, fileId: string) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function findFilesInFolder(token: string, folderId: string): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and trashed=false&fields=files(id,name,mimeType)&pageSize=1000`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return data.files || [];
}

async function downloadFileContent(token: string, fileId: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return await res.text();
}

async function downloadFileBase64(token: string, fileId: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

export async function backupToDrive(): Promise<{ success: number; failed: number }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Could not authenticate with Google Drive. Please try again.');

  const folderId = await findOrCreateFolder(token);

  const receipts = await getDocuments('receipt');
  const statements = await getDocuments('statement');
  const allDocs = [...receipts, ...statements];

  // Build manifest
  interface ManifestEntry { old_id: number; file_name: string; type: string; mime_type: string; date: string; created_at: string; drive_name: string; }
  interface ManifestLink { transaction_id: number; old_document_id: number; }
  const manifestDocs: ManifestEntry[] = [];
  const manifestLinks: ManifestLink[] = [];

  let success = 0;
  let failed = 0;

  // Delete old files in folder first
  const existingFiles = await findFilesInFolder(token, folderId);
  for (const f of existingFiles) {
    await deleteFileFromDrive(token, f.id);
  }

  // Build a map of all available document data from both IndexedDB and localStorage
  const dataMap: Record<string, string> = {};

  // Scan localStorage for any myser_doc_ keys (legacy data, possibly mismatched IDs)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('myser_doc_')) {
      const data = localStorage.getItem(key);
      if (data) dataMap[key] = data;
    }
  }

  // Also check IndexedDB for each document
  for (const doc of allDocs) {
    const idbData = await getDocumentData(doc.id);
    if (idbData) dataMap[`myser_doc_${doc.id}`] = idbData;
  }

  for (const doc of allDocs) {
    // Try exact ID match first, then scan all keys for any data
    let data = dataMap[`myser_doc_${doc.id}`] || null;

    if (!data) {
      // No exact match — skip this doc
      failed++;
      continue;
    }

    const ext = doc.mime_type.includes('pdf') ? 'pdf' : doc.mime_type.includes('png') ? 'png' : 'jpg';
    const safeName = doc.file_name.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
    const driveName = `${doc.id}_${safeName}.${ext}`;

    const fileId = await uploadFileToDrive(token, folderId, driveName, doc.mime_type, data, true);
    if (fileId) {
      manifestDocs.push({ old_id: doc.id, file_name: doc.file_name, type: doc.type, mime_type: doc.mime_type, date: doc.date, created_at: doc.created_at, drive_name: driveName });
      success++;
    } else {
      failed++;
    }
  }

  // Also upload any orphaned localStorage data that doesn't match a document ID
  const docIds = new Set(allDocs.map(d => `myser_doc_${d.id}`));
  for (const [key, data] of Object.entries(dataMap)) {
    if (!docIds.has(key)) {
      const id = key.replace('myser_doc_', '');
      const driveName = `orphan_${id}.jpg`;
      const fileId = await uploadFileToDrive(token, folderId, driveName, 'image/jpeg', data, true);
      if (fileId) success++;
    }
  }

  // Get transaction links
  const database = await getDb();
  const txResults = database.exec('SELECT id, document_id FROM transactions WHERE document_id IS NOT NULL');
  if (txResults.length) {
    for (const row of txResults[0].values) {
      manifestLinks.push({ transaction_id: row[0] as number, old_document_id: row[1] as number });
    }
  }

  // Upload manifest
  const manifest = JSON.stringify({ version: 1, exported_at: new Date().toISOString(), documents: manifestDocs, links: manifestLinks }, null, 2);
  await uploadFileToDrive(token, folderId, MANIFEST_NAME, 'application/json', manifest, false);

  if (success > 0) {
    localStorage.setItem(BACKUP_KEY, new Date().toISOString());
  }

  return { success, failed };
}

export async function restoreFromDrive(): Promise<{ imported: number; linked: number }> {
  const token = await getAccessToken();
  if (!token) return { imported: 0, linked: 0 };

  const folderId = await findOrCreateFolder(token);
  if (!folderId) return { imported: 0, linked: 0 };

  const files = await findFilesInFolder(token, folderId);
  const manifestFile = files.find((f) => f.name === MANIFEST_NAME);
  if (!manifestFile) throw new Error('No backup manifest found in Google Drive');

  const manifestText = await downloadFileContent(token, manifestFile.id);
  const manifest = JSON.parse(manifestText);

  const idMap: Record<number, number> = {};
  let imported = 0;

  for (const entry of manifest.documents) {
    const driveFile = files.find((f: { name: string }) => f.name === entry.drive_name);
    if (!driveFile) continue;

    const base64 = await downloadFileBase64(token, driveFile.id);
    const newId = await addDocument({
      type: entry.type,
      file_name: entry.file_name,
      date: entry.date,
      mime_type: entry.mime_type,
      data_base64: base64,
    });

    idMap[entry.old_id] = newId;
    imported++;
  }

  // Re-link transactions
  let linked = 0;
  if (manifest.links?.length > 0) {
    const database = await getDb();
    for (const link of manifest.links) {
      const newDocId = idMap[link.old_document_id];
      if (newDocId) {
        database.run('UPDATE transactions SET document_id = ? WHERE id = ? OR document_id = ?', [newDocId, link.transaction_id, link.old_document_id]);
        linked++;
      }
    }
    persistDb(database);
  }

  return { imported, linked };
}

export function getLastBackupDate(): string | null {
  return localStorage.getItem(BACKUP_KEY);
}
