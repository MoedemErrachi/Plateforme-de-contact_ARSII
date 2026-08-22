import { getAuthToken, toApiError, ApiError, DOWNLOAD_TIMEOUT_MS } from '../services/api';

export interface DownloadResult {
  status: number;
  count: number | null;
  fileName: string;
}

/**
 * Télécharge le fichier streamé par un endpoint d'export et lit le header
 * X-Export-Count (nombre réel de lignes exportées, pour le journal).
 * Les erreurs réseau/timeout/crash serveur sont normalisées en ApiError :
 * les composants n'affichent jamais de texte brut type « Failed to fetch ».
 */
export async function downloadFromEndpoint(path: string, fileName: string): Promise<DownloadResult> {
  const token = getAuthToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(path, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal
    });
  } catch (err) {
    throw toApiError(err);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let message = `Erreur export (HTTP ${res.status})`;
    try {
      const json = await res.json();
      message = json?.error || json?.message || message;
    } catch {
      // corps non-JSON (ex. HTML d'erreur) : on garde le message générique
    }
    throw new ApiError(res.status >= 500 ? 'server' : 'client', message, res.status);
  }

  try {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;

    const disposition = res.headers.get('Content-Disposition');
    const match = disposition?.match(/filename="?([^";\s]+)"?/);
    anchor.download = match ? decodeURIComponent(match[1]) : fileName;

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    const countHeader = res.headers.get('X-Export-Count');
    return {
      status: res.status,
      count: countHeader ? Number(countHeader) : null,
      fileName: match ? decodeURIComponent(match[1]) : fileName
    };
  } catch (err) {
    // Flux interrompu pendant le téléchargement du blob.
    throw toApiError(err);
  }
}

export async function downloadCsvFromEndpoint(path: string, fileName: string): Promise<DownloadResult> {
  return downloadFromEndpoint(path, fileName);
}
