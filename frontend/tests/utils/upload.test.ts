import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateImageFile, uploadImage, readFileAsDataUrl, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from '../../src/utils/upload';

vi.mock('../../src/services/api', () => ({
  apiFetch: vi.fn()
}));

import { apiFetch } from '../../src/services/api';

const apiFetchMock = vi.mocked(apiFetch);

function makeFile(name: string, type: string, size: number): File {
  return new File([new ArrayBuffer(size)], name, { type, lastModified: 0 });
}

describe('validateImageFile', () => {
  afterEach(() => {});

  it('accepts PNG, JPEG and WebP within size limit', () => {
    expect(ALLOWED_IMAGE_TYPES).toEqual(['image/png', 'image/jpeg', 'image/webp']);
    for (const type of ALLOWED_IMAGE_TYPES) {
      expect(validateImageFile(makeFile('a', type, 1024))).toBeNull();
    }
  });

  it('rejects a disallowed mime type with the French error message', () => {
    expect(validateImageFile(makeFile('a.gif', 'image/gif', 1))).toBe('Format non autorisé. Formats acceptés : PNG, JPEG, WebP.');
  });

  it('rejects a file over 5 MB with the size message', () => {
    const over = validateImageFile(makeFile('big.png', 'image/png', MAX_IMAGE_SIZE + 1));
    expect(over).toBe('Image trop volumineuse. Taille maximale : 5 Mo.');
  });

  it('accepts a file exactly at the size limit', () => {
    expect(validateImageFile(makeFile('big.png', 'image/png', MAX_IMAGE_SIZE))).toBeNull();
  });
});

describe('uploadImage', () => {
  beforeEach(() => apiFetchMock.mockReset());

  it('returns payload.url when the server returns a URL', async () => {
    apiFetchMock.mockResolvedValue({ url: 'https://cdn/avatar.png' });
    await expect(uploadImage('data:image/png;base64,xxx')).resolves.toBe('https://cdn/avatar.png');
    expect(apiFetchMock).toHaveBeenCalledWith('/api/uploads/avatar', {
      method: 'POST',
      body: JSON.stringify({ dataUrl: 'data:image/png;base64,xxx' })
    });
  });

  it('falls back to payload.dataUrl when no URL is present', async () => {
    apiFetchMock.mockResolvedValue({ dataUrl: 'data:image/png;base64,yyy' });
    await expect(uploadImage('data:image/png;base64,yyy')).resolves.toBe('data:image/png;base64,yyy');
  });

  it('returns undefined when the payload has neither url nor dataUrl', async () => {
    apiFetchMock.mockResolvedValue({ ok: true });
    await expect(uploadImage('data:image/png;base64,zzz')).resolves.toBeUndefined();
  });
});

describe('readFileAsDataUrl', () => {
  let readerInstance: any;

  function fakeFileReader(this: any): void {
    this.result = null;
    this.onload = null;
    this.onerror = null;
    this.readAsDataURL = vi.fn(() => {
      // jsdom ne déclenche pas d'événements : déclenchés manuellement par le test.
    });
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    readerInstance = this;
  }

  beforeEach(() => {
    readerInstance = undefined;
    vi.stubGlobal('FileReader', fakeFileReader);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves with a string result', async () => {
    const p = readFileAsDataUrl(makeFile('a.png', 'image/png', 1));
    const reader = readerInstance;
    reader.result = 'data:image/png;base64,abc';
    reader.onload?.();
    await expect(p).resolves.toBe('data:image/png;base64,abc');
  });

  it('rejects when the reader returns a non-string result', async () => {
    const p = readFileAsDataUrl(makeFile('a.png', 'image/png', 1));
    const reader = readerInstance;
    reader.result = null;
    reader.onload?.();
    await expect(p).rejects.toThrow('Lecture du fichier impossible.');
  });

  it('rejects when the reader errors', async () => {
    const p = readFileAsDataUrl(makeFile('a.png', 'image/png', 1));
    readerInstance.onerror?.();
    await expect(p).rejects.toThrow('Lecture du fichier impossible.');
  });
});