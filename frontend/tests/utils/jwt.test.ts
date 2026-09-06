import { describe, expect, it } from 'vitest';
import { decodeJwt, isTokenExpired, secondsUntilExpiry } from '../../src/utils/jwt';

function b64url(input: string): string {
  const b64 = btoa(unescape(encodeURIComponent(input)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeToken(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

describe('decodeJwt', () => {
  it('decodes a valid JWT payload', () => {
    const token = makeToken({ id: '1', email: 'a@b.com', role: 'admin' });
    const decoded = decodeJwt(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.email).toBe('a@b.com');
    expect(decoded?.role).toBe('admin');
  });

  it('returns null for a malformed token', () => {
    expect(decodeJwt('not-a-jwt')).toBeNull();
    expect(decodeJwt('a.b')).toBeNull();
  });

  it('returns null for an invalid base64 payload', () => {
    expect(decodeJwt('header.%%%%.sig')).toBeNull();
  });

  it('handles tokens with empty payload part', () => {
    expect(decodeJwt('header..sig')).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('returns false for empty/null/undefined token', () => {
    expect(isTokenExpired(null)).toBe(false);
    expect(isTokenExpired(undefined)).toBe(false);
    expect(isTokenExpired('')).toBe(false);
  });

  it('returns false for an undecodable token', () => {
    expect(isTokenExpired('garbage')).toBe(false);
  });

  it('returns false when exp is missing', () => {
    expect(isTokenExpired(makeToken({ email: 'a@b.com' }))).toBe(false);
  });

  it('returns true for an expired token', () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) - 60 });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('returns false for a future expiration', () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isTokenExpired(token)).toBe(false);
  });
});

describe('secondsUntilExpiry', () => {
  it('returns 0 when token is empty/undecodable/no exp', () => {
    expect(secondsUntilExpiry(null)).toBe(0);
    expect(secondsUntilExpiry('garbage')).toBe(0);
    expect(secondsUntilExpiry(makeToken({ email: 'a@b.com' }))).toBe(0);
  });

  it('returns 0 for an expired token', () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) - 60 });
    expect(secondsUntilExpiry(token)).toBe(0);
  });

  it('returns a positive number for a future expiration', () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 120 });
    const seconds = secondsUntilExpiry(token);
    expect(seconds).toBeGreaterThan(100);
    expect(seconds).toBeLessThanOrEqual(121);
  });
});
