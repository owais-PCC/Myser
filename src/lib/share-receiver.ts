import { registerPlugin } from '@capacitor/core';

interface ShareReceiverPlugin {
  getPendingShare(): Promise<{ base64?: string; mimeType?: string }>;
}

const ShareReceiver = registerPlugin<ShareReceiverPlugin>('ShareReceiver');

export async function checkPendingShare(): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const result = await ShareReceiver.getPendingShare();
    if (result.base64) {
      return { base64: result.base64, mimeType: result.mimeType || 'image/jpeg' };
    }
    return null;
  } catch {
    return null;
  }
}
