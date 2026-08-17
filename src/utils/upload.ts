import { apiFetch } from './api';

export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Format non autorisé. Formats acceptés : PNG, JPEG, WebP.';
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return 'Image trop volumineuse. Taille maximale : 5 Mo.';
  }
  return null;
}

export async function uploadImage(dataUrl: string): Promise<string> {
  const json = await apiFetch('/api/uploads/avatar', {
    method: 'POST',
    body: JSON.stringify({ dataUrl })
  });
  return json?.url ?? json?.dataUrl;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });
}
