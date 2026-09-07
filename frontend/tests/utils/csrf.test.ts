import { describe, it, expect, afterEach } from 'vitest';
import { getCsrfToken, csrfHeaders } from '../../src/utils/csrf';

function setCookie(value: string): void {
  Object.defineProperty(document, 'cookie', { value, configurable: true, writable: true });
}

afterEach(() => {
  delete (document as any).cookie;
});

describe('getCsrfToken', () => {
  it('extracts and URL-decodes the XSRF-TOKEN cookie', () => {
    setCookie('session=abc; XSRF-TOKEN=tok%20en; path=/');
    expect(getCsrfToken()).toBe('tok en');
  });

  it('returns null when the cookie is not present', () => {
    setCookie('session=abc; path=/');
    expect(getCsrfToken()).toBeNull();
  });

  it('returns null on an empty cookie string', () => {
    setCookie('');
    expect(getCsrfToken()).toBeNull();
  });
});

describe('csrfHeaders', () => {
  it('returns the X-CSRF-Token header when a token exists', () => {
    setCookie('XSRF-TOKEN=xyz');
    expect(csrfHeaders()).toEqual({ 'X-CSRF-Token': 'xyz' });
  });

  it('returns an empty object when no token exists', () => {
    setCookie('other=1');
    expect(csrfHeaders()).toEqual({});
  });
});