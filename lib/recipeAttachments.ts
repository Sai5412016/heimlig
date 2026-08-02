// lib/recipeAttachments.ts — upload/read the original photo a recipe was imported from,
// stored in the private 'recipe-images' Supabase Storage bucket. Same pattern as
// lib/taskAttachments.ts: RLS scopes access to members of the household in the file's path,
// so a signed URL has to be generated on demand rather than stored permanently.
import { supabase } from './supabase';

function randomId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Upload the recipe's source photo (base64, as returned by ImagePicker) and return the
// storage path to save on the recipe row.
export async function uploadRecipeImage(householdId: string, base64: string, mimeType: string): Promise<string | null> {
  try {
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const path = `${householdId}/${randomId()}.${ext}`;
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const { error } = await supabase.storage.from('recipe-images').upload(path, bytes, {
      contentType: mimeType,
      upsert: true,
    });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

export async function deleteRecipeImage(path: string): Promise<void> {
  try { await supabase.storage.from('recipe-images').remove([path]); } catch { /* best-effort */ }
}

// Signed URL valid for an hour — generated fresh each time the original photo is opened.
export async function getRecipeImageUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('recipe-images').createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}
