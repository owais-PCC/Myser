import { resetDb } from './db';

export function clearAllUserData() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('financeapp_db');
  localStorage.removeItem('myser_sync_enabled');
  localStorage.removeItem('financeapp_mode');
  localStorage.removeItem('financeapp_currency');
  localStorage.removeItem('settings_autoswitch');
  localStorage.removeItem('settings_advancedanalytics');
  localStorage.removeItem('myser_last_drive_backup');
  localStorage.removeItem('myser_drive_token');
  localStorage.removeItem('myser_drive_token_expiry');
  localStorage.removeItem('myser_last_uid');

  // Remove all document data keys from localStorage
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('myser_doc_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));

  // Clear IndexedDB document cache
  (async () => {
    try {
      const { idbClear } = await import('./doc-store');
      await idbClear();
    } catch { /* ignore */ }
  })();

  resetDb();
}
