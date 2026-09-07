import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadFromEndpoint, downloadCsvFromEndpoint } from '../../src/utils/download';
import { ApiError } from '../../src/services/api';

function fakeResponse(overrides: Partial<{
  ok: boolean;
  status: number;
  json: unknown;
  jsonThrows: boolean;
  blobThrows: boolean;
  headers: Record<string, string | null>;
}>) {
  const headers = overrides.headers ?? {};
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    async json() {
      if (overrides.jsonThrows) throw new Error('not json');
      return overrides.json ?? null;
    },
    async blob() {
      if (overrides.blobThrows) throw new Error('blob failed');
      return new Blob(['data']);
    },
    headers: {
      get(name: string) {
        return name in headers ? headers[name] : null;
      }
    }
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:test'),
    revokeObjectURL: vi.fn()
  }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe('downloadFromEndpoint', () => {
  it('downloads the streamed file and reads X-Export-Count and Content-Disposition', async () => {
    localStorage.setItem('euraxess_token', 'tok-123');
    fetchMock.mockResolvedValue(fakeResponse({
      headers: {
        'Content-Disposition': 'attachment; filename="contacts_export.csv"',
        'X-Export-Count': '42'
      }
    }));

    const result = await downloadFromEndpoint('/api/exports/contacts', 'fallback.csv');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/exports/contacts');
    expect(init).toMatchObject({ credentials: 'include', headers: { Authorization: 'Bearer tok-123' } });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(result).toEqual({ status: 200, count: 42, fileName: 'contacts_export.csv' });
  });

  it('falls back to the provided fileName when Content-Disposition is absent', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ headers: { 'X-Export-Count': '7' } }));
    const result = await downloadFromEndpoint('/api/exports/contacts', 'fallback.csv');
    expect(result.fileName).toBe('fallback.csv');
    expect(result.count).toBe(7);
  });

  it('does not send an Authorization header when no token is stored', async () => {
    fetchMock.mockResolvedValue(fakeResponse({}));
    await downloadFromEndpoint('/api/exports/contacts', 'fallback.csv');
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers).toEqual({});
  });

  it('normalises a client-side HTTP error into an ApiError with the server message', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ ok: false, status: 404, json: { error: 'Introuvable' } }));
    await expect(downloadFromEndpoint('/api/exports/contacts', 'x.csv')).rejects.toMatchObject({
      kind: 'client',
      status: 404,
      message: 'Introuvable'
    });
  });

  it('keeps the generic message when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ ok: false, status: 500, jsonThrows: true }));
    await expect(downloadFromEndpoint('/api/exports/contacts', 'x.csv')).rejects.toMatchObject({
      kind: 'server',
      status: 500,
      message: 'Erreur export (HTTP 500)'
    });
  });

  it('normalises a network failure into a friendly ApiError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(downloadFromEndpoint('/api/exports/contacts', 'x.csv')).rejects.toMatchObject({
      kind: 'network',
      message: 'Impossible de contacter le serveur. Vérifiez votre connexion ou réessayez plus tard.'
    });
  });

  it('propagates a blob failure as a normalised ApiError', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ blobThrows: true }));
    await expect(downloadFromEndpoint('/api/exports/contacts', 'x.csv')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('downloadCsvFromEndpoint', () => {
  it('is an alias of downloadFromEndpoint', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ headers: { 'X-Export-Count': '1' } }));
    await expect(downloadCsvFromEndpoint('/api/exports/contacts.csv', 'out.csv')).resolves.toMatchObject({
      status: 200,
      count: 1
    });
  });
});