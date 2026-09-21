// lib/imageResize.ts — shrink a locally picked photo (camera or gallery, via expo-image-picker's
// `uri`) before it goes anywhere over the network. expo-image-picker's own `quality` option only
// controls JPEG compression, not dimensions — a modern phone camera photo at quality 0.6 still
// keeps its full sensor resolution (often 3000-4000px on the long edge), which is why a scanned
// receipt was landing in Supabase Storage at roughly 900 KB per photo with nothing actually using
// that resolution on either end (see components/ReceiptScanModal.tsx for where this is called).
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export interface ResizedImage { base64: string; mimeType: string }

// Scales so the LONGER edge is at most maxDimension, preserving aspect ratio, regardless of
// whether the photo is portrait or landscape — passing only one of width/height to resize() would
// constrain the wrong edge for a portrait photo. width/height come from the picker's own result
// (ImagePicker.ImagePickerAsset already reports them; no separate probe of the file needed).
// Returns null on any failure (including width/height being unknown, i.e. 0) — the caller falls
// back to the original, unresized photo rather than losing the upload entirely.
export async function resizeImage(
  uri: string, width: number, height: number,
  maxDimension: number, quality: number,
): Promise<ResizedImage | null> {
  if (!width || !height) return null;
  try {
    const longEdge = Math.max(width, height);
    const scale = Math.min(1, maxDimension / longEdge);
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const rendered = await ImageManipulator.manipulate(uri).resize({ width: targetWidth, height: targetHeight }).renderAsync();
    const result = await rendered.saveAsync({ compress: quality, format: SaveFormat.JPEG, base64: true });
    if (!result.base64) return null;
    return { base64: result.base64, mimeType: 'image/jpeg' };
  } catch {
    return null;
  }
}
