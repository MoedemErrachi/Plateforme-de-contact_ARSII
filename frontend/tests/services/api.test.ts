import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiFetch, ApiError, toApiError, isServiceUnreachable,
  setGlobalApiErrorHandler, getAuthToken, clearStoredAuth,
  notifyAuthExpired, DEFAULT_TIMEOUT_MS
} from '../../src/services/api';

function makeJwt(exp: number): string {
  const payload = btoa(JSON.stringify({ exp, sub: '1', role: 'ADMIN' }));
  return `abc.${payload}.sig`;
}

function jsonResponse(body: unknown, status = 200, init: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    },
    headers: new Headers(init)
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  setGlobalApiErrorHandler(null);
});

describe('toApiError', () => {
  it('passes through an existing ApiError', () => {
    const err = new ApiError('client', 'msg', 400);
    expect(toApiError(err)).toBe(err);
  });

  it('maps an AbortError to a timeout ApiError', () => {
    const err = toApiError(new DOMException('abort', 'AbortError'));
    expect(err.kind).toBe('timeout');
    expect(err.message).toContain('trop de temps');
  });

  it('maps a TypeError (network) to a network ApiError', () => {
    const err = toApiError(new TypeError('Failed to fetch'));
    expect(err.kind).toBe('network');
    expect(err.message).toContain('Impossible de contacter le serveur');
  });

  it('maps unknown errors to a client ApiError with a fallback message', () => {
    const err = toApiError(new Error('boom'));
    expect(err.kind).toBe('client');
    expect(err.message).toBe('boom');
  });

  it('maps a non-Error with no message to the generic unexpected message', () => {
    const err = toApiError({ weird: true });
    expect(err.kind).toBe('client');
    expect(err.message).toBe('Une erreur inattendue est survenue.');
  });
});

describe('isServiceUnreachable', () => {
  it('is true for network, timeout and server kinds', () => {
    expect(isServiceUnreachable(new ApiError('network', 'a'))).toBe(true);
    expect(isServiceUnreachable(new ApiError('timeout', 'a'))).toBe(true);
    expect(isServiceUnreachable(new ApiError('server', 'a'))).toBe(true);
  });

  it('is false for client and auth kinds and non-ApiErrors', () => {
    expect(isServiceUnreachable(new ApiError('client', 'a'))).toBe(false);
    expect(isServiceUnreachable(new ApiError('auth', 'a'))).toBe(false);
    expect(isServiceUnreachable(new Error('x'))).toBe(false);
  });
});

describe('getAuthToken / clearStoredAuth', () => {
  it('reads a token from localStorage, preferring it over sessionStorage', () => {
    localStorage.setItem('euraxess_token', 'local-tok');
    sessionStorage.setItem('euraxess_token', 'sess-tok');
    expect(getAuthToken()).toBe('local-tok');
  });

  it('reads a token from sessionStorage when localStorage is empty', () => {
    sessionStorage.setItem('euraxess_token', 'sess-tok');
    expect(getAuthToken()).toBe('sess-tok');
  });

  it('trims whitespace and returns null for a blank token', () => {
    localStorage.setItem('euraxess_token', '   ');
    expect(getAuthToken()).toBeNull();
  });

  it('returns null when no token is stored anywhere', () => {
    expect(getAuthToken()).toBeNull();
  });

  it('clears the token from both storages', () => {
    localStorage.setItem('euraxess_token', 'a');
    sessionStorage.setItem('euraxess_token', 'b');
    clearStoredAuth();
    expect(getAuthToken()).toBeNull();
  });
});

describe('notifyAuthExpired', () => {
  it('dispatches the auth:expired custom event with the reason', () => {
    const listener = vi.fn();
    window.addEventListener('auth:expired', listener);
    notifyAuthExpired('expired-local');
    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ reason: 'expired-local' });
    window.removeEventListener('auth:expired', listener);
  });
});

describe('apiFetch', () => {
  it('sends GET without a token and returns parsed JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [1, 2] }));
    const result = await apiFetch('/api/contacts');
    expect(result).toEqual({ items: [1, 2] });
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/contacts');
    expect(init.method).toBeUndefined();
    expect(init.credentials).toBe('include');
  });

  it('attaches the Bearer token when present', async () => {
    localStorage.setItem('euraxess_token', 'tok-9');
    fetchMock.mockResolvedValue(jsonResponse({}));
    await apiFetch('/api/contacts');
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.get('Authorization')).toBe('Bearer tok-9');
  });

  it('adds a JSON Content-Type for string bodies', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await apiFetch('/api/contacts', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('does not force a Content-Type when the body is FormData', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const form = new FormData();
    form.append('file', 'x');
    await apiFetch('/api/upload', { method: 'POST', body: form });
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.has('Content-Type')).toBe(false);
  });

  it('adds CSRF header for mutating methods', async () => {
    Object.defineProperty(document, 'cookie', { value: 'XSRF-TOKEN=csrf1', configurable: true });
    fetchMock.mockResolvedValue(jsonResponse({}));
    await apiFetch('/api/contacts', { method: 'PUT', body: '{}' });
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.get('X-CSRF-Token')).toBe('csrf1');
    delete (document as any).cookie;
  });

  it('fails fast locally when the token is already expired', async () => {
    const expired = makeJwt(Math.floor(Date.now() / 1000) - 1000);
    localStorage.setItem('euraxess_token', expired);
    await expect(apiFetch('/api/contacts')).rejects.toMatchObject({
      kind: 'auth',
      expiredLocally: true
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getAuthToken()).toBeNull();
  });

  it('throws an auth ApiError and purges+notifies on a 401 for a non-auth action', async () => {
    localStorage.setItem('euraxess_token', 'tok');
    const listener = vi.fn();
    window.addEventListener('auth:expired', listener);
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Unauthorized' }, 401));

    await expect(apiFetch('/api/contacts')).rejects.toMatchObject({ kind: 'auth', status: 401 });
    expect(getAuthToken()).toBeNull();
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: { reason: 'unauthorized' } }));
    window.removeEventListener('auth:expired', listener);
  });

  it('does NOT purge on a 401 for an auth action (login attempt)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Invalid credentials' }, 401));
    await expect(apiFetch('/api/auth/login', { method: 'POST', suppressGlobalError: true }))
      .rejects.toMatchObject({ kind: 'auth', message: 'Invalid credentials' });
    expect(getAuthToken()).toBeNull();
  });

  it('maps a 5xx response to a server ApiError with the friendly fallback message', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));
    await expect(apiFetch('/api/contacts')).rejects.toMatchObject({
      kind: 'server',
      status: 500,
      message: 'Service temporairement indisponible. Veuillez réessayer plus tard.'
    });
  });

  it('maps a 429 without a message to the rate-limit message', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 429));
    await expect(apiFetch('/api/contacts')).rejects.toMatchObject({
      kind: 'client',
      message: 'Trop de requêtes. Veuillez patienter quelques instants avant de réessayer.'
    });
  });

  it('prefers server-provided messages over the fallbacks', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Ressource introuvable' }, 404));
    await expect(apiFetch('/api/contacts')).rejects.toMatchObject({
      kind: 'client',
      message: 'Ressource introuvable'
    });
  });

  it('maps a network TypeError in fetch to a network ApiError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(apiFetch('/api/contacts')).rejects.toMatchObject({ kind: 'network' });
  });

  it('rethrows when the caller abort requested (not a timeout)', async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(new DOMException('abort', 'AbortError'));
    await expect(apiFetch('/api/contacts', { signal: controller.signal }))
      .rejects.toEqual(new DOMException('abort', 'AbortError'));
  });

  it('returns null for a 204-style empty body', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 204,
      async text() { return ''; }
    } as unknown as Response);
    await expect(apiFetch('/api/contacts')).resolves.toBeNull();
  });

  it('returns null when the body is non-JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      async text() { return '<html>oops</html>'; }
    } as unknown as Response);
    await expect(apiFetch('/api/contacts')).resolves.toBeNull();
  });

  it('invokes the global handler for unreachable services and honours suppressGlobalError', async () => {
    const handler = vi.fn();
    setGlobalApiErrorHandler(handler);
    fetchMock.mockResolvedValue(jsonResponse({}, 503));

    await expect(apiFetch('/api/contacts')).rejects.toMatchObject({ kind: 'server' });
    expect(handler).toHaveBeenCalledTimes(1);

    handler.mockClear();
    await expect(apiFetch('/api/contacts', { suppressGlobalError: true })).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not call the global handler for client errors', async () => {
    const handler = vi.fn();
    setGlobalApiErrorHandler(handler);
    fetchMock.mockResolvedValue(jsonResponse({}, 404));
    await expect(apiFetch('/api/contacts')).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();
  });

  it('uses a caller-provided timeout', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_, init) => new Promise((_res, rej) => {
      init.signal.addEventListener('abort', () => rej(new DOMException('abort', 'AbortError')));
    }));
    const p = apiFetch('/api/contacts', { timeoutMs: 50 });
    vi.advanceTimersByTime(50);
    await expect(p).rejects.toMatchObject({ kind: 'timeout' });
    vi.useRealTimers();
  });
});