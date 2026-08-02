// lib/receiptAttachments.ts — upload/read a receipt photo, stored in the private 'receipts'
// Supabase Storage bucket. Same pattern as lib/recipeAttachments.ts / lib/taskAttachments.ts:
// RLS scopes access to members of the household in the file's path, so a signed URL has to be
// generated on demand rather than stored permanently.
import { supabase } from './supabase';

function randomId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Upload a scanned receipt photo (base64, as returned by ImagePicker) and return the storage
// path to save on the transaction row (transactions.receipt_url).
export async function uploadReceiptImage(householdId: string, base64: string, mimeType: string): Promise<string | null> {
  try {
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const path = `${householdId}/${randomId()}.${ext}`;
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const { error } = await supabase.storage.from('receipts').upload(path, bytes, {
      contentType: mimeType,
      upsert: true,
    });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

export async function deleteReceiptImage(path: string): Promise<void> {
  try { await supabase.storage.from('receipts').remove([path]); } catch { /* best-effort */ }
}

// Signed URL valid for an hour — generated fresh each time the receipt photo is opened.
export async function getReceiptImageUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}
