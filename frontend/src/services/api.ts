import { csrfHeaders } from '../utils/csrf';
import { isTokenExpired } from '../utils/jwt';

const TOKEN_STORAGE_KEY = 'euraxess_token';

// ─────────────────────────────────────────────────────────────────────────────
// Timeouts par défaut (ms) — surchargables par appel via `timeoutMs`
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_TIMEOUT_MS = 20000;
export const OCR_TIMEOUT_MS = 90000;
export const CHAT_TIMEOUT_MS = 45000;
export const DOWNLOAD_TIMEOUT_MS = 60000;

/**
 * Messages utilisateur garantis : aucune erreur réseau brute (« Failed to
 * fetch », stack trace, [object Object]…) ne doit atteindre l'interface.
 */
const FRIENDLY_MESSAGES: Record<'network' | 'timeout' | 'server', string> = {
  network: 'Impossible de contacter le serveur. Vérifiez votre connexion ou réessayez plus tard.',
  timeout: 'Le serveur met trop de temps à répondre. Veuillez réessayer.',
  server: 'Service temporairement indisponible. Veuillez réessayer plus tard.'
};

export type ApiErrorKind = 'network' | 'timeout' | 'server' | 'auth' | 'client';

/** Erreur API normalisée : seule classe d'erreur propagée aux composants. */
export class ApiError extends Error {
  kind: ApiErrorKind;
  status: number;
  data: any;
  expiredLocally?: boolean;

  constructor(kind: ApiErrorKind, message: string, status = 0, data: any = null, expiredLocally?: boolean) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.data = data;
    this.expiredLocally = expiredLocally;
  }
}

/** Convertit n'importe quelle exception (fetch direct, abort…) en ApiError. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  // AbortError d'un contrôleur externe → traité comme un délai dépassé.
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new ApiError('timeout', FRIENDLY_MESSAGES.timeout);
  }
  // fetch() lève une TypeError pour réseau/CORS/DNS indisponible.
  if (err instanceof TypeError) {
    return new ApiError('network', FRIENDLY_MESSAGES.network);
  }
  const raw = err instanceof Error && err.message ? err.message : '';
  return new ApiError('client', raw || 'Une erreur inattendue est survenue.');
}

/** Service injoignable (réseau, timeout ou crash serveur 5xx) ? */
export function isServiceUnreachable(err: unknown): boolean {
  return err instanceof ApiError && (err.kind === 'network' || err.kind === 'timeout' || err.kind === 'server');
}

// ─────────────────────────────────────────────────────────────────────────────
// Registre du gestionnaire d'erreurs global (toast). Enregistré une fois par
// App : toute erreur « service injoignable » non supprimée déclenche un toast,
// sauf opt-out par appel ({ suppressGlobalError: true }).
// ─────────────────────────────────────────────────────────────────────────────
type GlobalApiErrorHandler = (err: ApiError) => void;
let globalErrorHandler: GlobalApiErrorHandler | null = null;

export function setGlobalApiErrorHandler(handler: GlobalApiErrorHandler | null): void {
  globalErrorHandler = handler;
}

function notifyGlobalIfUnreachable(err: ApiError, suppress?: boolean): void {
  if (suppress || !isServiceUnreachable(err)) return;
  try {
    globalErrorHandler?.(err);
  } catch {
    // Le gestionnaire ne doit jamais interrompre le flux d'erreur appelant.
  }
}

export function getAuthToken(): string | null {
  try {
    const value = localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

/** Purge le jeton des deux stockages (logout local instantané, sans réseau). */
export function clearStoredAuth(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Événement global émis quand la session est morte (401 serveur ou expiration
 * locale détectée avant l'appel). App.tsx s'abonne pour déconnecter
 * instantanément et rediriger vers /login.
 */
export function notifyAuthExpired(reason: 'expired-local' | 'unauthorized' = 'unauthorized'): void {
  window.dispatchEvent(new CustomEvent('auth:expired', { detail: { reason } }));
}

const STATE_CHANGING_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * Endpoints d'authentification : un 401 y est un résultat métier attendu
 * (identifiants invalides) et ne doit PAS purger la session ni émettre
 * l'événement auth:expired.
 */
const AUTH_ACTION_PATTERNS = ['/api/auth/login', '/api/auth/forgot-password', '/api/auth/reset', '/api/auth/change-password'];

export interface ApiFetchOptions extends RequestInit {
  /** Délai d'expiration en ms (défaut : DEFAULT_TIMEOUT_MS). */
  timeoutMs?: number;
  /** Désactive le toast global pour cet appel (le composant gère lui-même). */
  suppressGlobalError?: boolean;
}

function firstServerMessage(json: any): string {
  if (typeof json?.error === 'string' && json.error) return json.error;
  if (typeof json?.message === 'string' && json.message) return json.message;
  if (typeof json?.detail === 'string' && json.detail) return json.detail;
  return '';
}

export async function apiFetch<T = any>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, suppressGlobalError, ...init } = options;
  const token = getAuthToken();
  const isAuthAction = AUTH_ACTION_PATTERNS.some(pattern => path.includes(pattern));

  // Expiration déjà constatée côté client → échec immédiat sans requête réseau
  // (évite les 401/500 inutiles et les boucles de redirection).
  if (token && isTokenExpired(token)) {
    clearStoredAuth();
    notifyAuthExpired('expired-local');
    throw new ApiError('auth', 'Votre session a expiré. Veuillez vous reconnecter.', 401, null, true);
  }

  const headers = new Headers(init.headers);
  // Ne poser Content-Type JSON que pour un corps texte : un FormData doit
  // laisser le navigateur générer son multipart/form-data (upload OCR).
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!init.method || STATE_CHANGING_METHODS.includes(init.method.toUpperCase())) {
    Object.entries(csrfHeaders()).forEach(([k, v]) => {
      if (!headers.has(k)) headers.set(k, v);
    });
  }

  // Timeout chaîné : un abort externe (pagination, filtres) reste prioritaire
  // et est re-levé tel quel pour que les appelants puissent l'ignorer.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(timeoutMs, 1));
  const externalSignal = init.signal ?? null;
  const forwardExternalAbort = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener('abort', forwardExternalAbort);

  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers,
      credentials: 'include'
    });
  } catch (err) {
    if (externalSignal?.aborted) throw err; // abandon demandé par l'appelant
    const apiErr = toApiError(timedOut ? new DOMException('Aborted', 'AbortError') : err);
    notifyGlobalIfUnreachable(apiErr, suppressGlobalError);
    throw apiErr;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', forwardExternalAbort);
  }

  const text = await res.text();
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null; // corps non-JSON (page HTML de crash, corps vide…)
    }
  }

  if (!res.ok) {
    const serverMessage = firstServerMessage(json);
    let kind: ApiErrorKind = 'client';
    let message = serverMessage;

    if (res.status >= 500) {
      kind = 'server';
      message = serverMessage || FRIENDLY_MESSAGES.server;
    } else if (res.status === 401) {
      kind = 'auth';
      if (!isAuthAction) {
        // Session rejetée par le serveur → purge locale + notification globale.
        clearStoredAuth();
        notifyAuthExpired('unauthorized');
      }
      message = serverMessage || 'Session expirée ou non autorisée.';
    } else if (res.status === 429 && !message) {
      message = 'Trop de requêtes. Veuillez patienter quelques instants avant de réessayer.';
    }

    const apiErr = new ApiError(kind, message, res.status, json);
    notifyGlobalIfUnreachable(apiErr, suppressGlobalError);
    throw apiErr;
  }

  return json as T;
}
