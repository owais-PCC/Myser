import JSZip from 'jszip';
import { getDocuments, getDocumentData, addDocument, getDb, persistDb } from './db';

interface ManifestEntry {
  old_id: number;
  file_name: string;
  type: 'receipt' | 'statement';
  mime_type: string;
  date: string;
  created_at: string;
  zip_path: string;
}

interface ManifestLink {
  transaction_id: number;
  old_document_id: number;
}

interface Manifest {
  version: 1;
  exported_at: string;
  documents: ManifestEntry[];
  links: ManifestLink[];
}

export async function getExportableCount(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  let count = 0;
  // Check IndexedDB
  try {
    const { idbCount } = await import('./doc-store');
    count += await idbCount();
  } catch { /* ignore */ }
  // Also check localStorage (legacy data)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('myser_doc_')) count++;
  }
  return count;
}

export async function exportReceiptsAsZip(): Promise<number> {
  const receipts = await getDocuments('receipt');
  const statements = await getDocuments('statement');
  const allDocs = [...receipts, ...statements];

  if (allDocs.length === 0) throw new Error('No documents found');

  const zip = new JSZip();
  const receiptsFolder = zip.folder('receipts')!;
  const statementsFolder = zip.folder('statements')!;

  const manifest: Manifest = {
    version: 1,
    exported_at: new Date().toISOString(),
    documents: [],
    links: [],
  };

  let count = 0;

  // Build data map from both IndexedDB and localStorage
  const dataMap: Record<number, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('myser_doc_')) {
      const id = parseInt(key.replace('myser_doc_', ''));
      const data = localStorage.getItem(key);
      if (data && !isNaN(id)) dataMap[id] = data;
    }
  }
  for (const doc of allDocs) {
    const idbData = await getDocumentData(doc.id);
    if (idbData) dataMap[doc.id] = idbData;
  }

  for (const doc of allDocs) {
    const data = dataMap[doc.id] || null;
    if (!data) continue;

    const ext = doc.mime_type.includes('pdf') ? 'pdf' : doc.mime_type.includes('png') ? 'png' : 'jpg';
    const safeName = doc.file_name.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
    const fileName = `${doc.id}_${safeName}.${ext}`;
    const folder = doc.type === 'receipt' ? receiptsFolder : statementsFolder;
    const zipPath = `${doc.type === 'receipt' ? 'receipts' : 'statements'}/${fileName}`;

    folder.file(fileName, data, { base64: true });
    manifest.documents.push({
      old_id: doc.id,
      file_name: doc.file_name,
      type: doc.type as 'receipt' | 'statement',
      mime_type: doc.mime_type,
      date: doc.date,
      created_at: doc.created_at,
      zip_path: zipPath,
    });
    count++;
  }

  if (count === 0) throw new Error('No receipt files available locally. Files may have been lost during sync.');

  // Get transaction-to-document links
  const database = await getDb();
  const txResults = database.exec('SELECT id, document_id FROM transactions WHERE document_id IS NOT NULL');
  if (txResults.length) {
    for (const row of txResults[0].values) {
      manifest.links.push({
        transaction_id: row[0] as number,
        old_document_id: row[1] as number,
      });
    }
  }

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const date = new Date().toISOString().slice(0, 10);
  const fileName = `myser-receipts-${date}.zip`;

  const base64Zip = await zip.generateAsync({ type: 'base64' });

  // Save to device Downloads via native Filesystem, fallback to blob download
  let saved = false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      await Filesystem.writeFile({
        path: `Download/${fileName}`,
        data: base64Zip,
        directory: Directory.ExternalStorage,
        recursive: true,
      });
      saved = true;
    }
  } catch { /* fallback to browser */ }

  if (!saved) {
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return count;
}

export async function importReceiptsFromZip(file: File): Promise<{ imported: number; linked: number }> {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('manifest.json');

  if (!manifestFile) {
    throw new Error('Invalid backup file — no manifest found');
  }

  const manifest: Manifest = JSON.parse(await manifestFile.async('text'));
  const idMap: Record<number, number> = {};
  let imported = 0;

  for (const entry of manifest.documents) {
    const zipFile = zip.file(entry.zip_path);
    if (!zipFile) continue;

    const base64 = await zipFile.async('base64');
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
  if (manifest.links.length > 0) {
    const database = await getDb();
    for (const link of manifest.links) {
      const newDocId = idMap[link.old_document_id];
      if (newDocId) {
        database.run(
          'UPDATE transactions SET document_id = ? WHERE id = ? OR document_id = ?',
          [newDocId, link.transaction_id, link.old_document_id]
        );
        linked++;
      }
    }
    persistDb(database);
  }

  return { imported, linked };
}
