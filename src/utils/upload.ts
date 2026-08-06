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
  const res = await fetch('/api/uploads/avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ dataUrl })
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || json.message || `API error ${res.status}`);
  }
  return json.url;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });
}
