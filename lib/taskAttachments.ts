// lib/taskAttachments.ts — upload/read/delete photo & document attachments for a task,
// stored in the private 'task-attachments' Supabase Storage bucket. RLS scopes access to
// members of the household in the file's path (see the add_task_attachments_and_location
// migration), so a signed URL has to be generated on demand rather than stored permanently.
import { File } from 'expo-file-system';
import { supabase } from './supabase';

export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
}

function randomId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Upload a picked photo/document and return the storage path + display name to save on
// the task. Not tied to a task id (a task may not exist yet while creating one), only to
// the household, which is all the RLS policy checks.
export async function uploadTaskAttachment(householdId: string, file: PickedFile): Promise<{ path: string; name: string } | null> {
  try {
    const bytes = await new File(file.uri).bytes();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${householdId}/${randomId()}_${safeName}`;
    const { error } = await supabase.storage.from('task-attachments').upload(path, bytes, {
      contentType: file.mimeType || 'application/octet-stream',
      upsert: true,
    });
    if (error) return null;
    return { path, name: file.name };
  } catch {
    return null;
  }
}

export async function deleteTaskAttachment(path: string): Promise<void> {
  try { await supabase.storage.from('task-attachments').remove([path]); } catch { /* best-effort */ }
}

// Signed URL valid for an hour — generated fresh each time the attachment is opened.
export async function getTaskAttachmentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('task-attachments').createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}
