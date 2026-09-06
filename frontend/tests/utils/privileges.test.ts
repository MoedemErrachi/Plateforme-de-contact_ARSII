import { describe, expect, it } from 'vitest';
import type { User } from '../../src/types';
import {
  effectivePrivilege,
  canCreate,
  canEdit,
  canDelete,
} from '../../src/utils/privileges';

function makeUser(partial: Partial<User>): User {
  return { id: '1', name: 'X', email: 'x@y.com', role: 'user', ...partial } as User;
}

describe('effectivePrivilege', () => {
  it('returns READ for null user', () => {
    expect(effectivePrivilege(null)).toBe('READ');
  });

  it('returns FULL_ACCESS for admins regardless of privilege', () => {
    expect(effectivePrivilege(makeUser({ role: 'admin', privilege: 'READ' }))).toBe('FULL_ACCESS');
  });

  it('returns the user privilege for non-admins', () => {
    expect(effectivePrivilege(makeUser({ role: 'user', privilege: 'READ_WRITE' }))).toBe('READ_WRITE');
  });

  it('falls back to FULL_ACCESS when privilege is missing', () => {
    expect(effectivePrivilege(makeUser({ role: 'user' }))).toBe('FULL_ACCESS');
  });
});

describe('permission checks', () => {
  it('guests cannot create/edit/delete', () => {
    expect(canCreate(null)).toBe(false);
    expect(canEdit(null)).toBe(false);
    expect(canDelete(null)).toBe(false);
  });

  it('READ cannot create/edit/delete', () => {
    const user = makeUser({ privilege: 'READ' });
    expect(canCreate(user)).toBe(false);
    expect(canEdit(user)).toBe(false);
    expect(canDelete(user)).toBe(false);
  });

  it('READ_WRITE can create and edit but not delete', () => {
    const user = makeUser({ privilege: 'READ_WRITE' });
    expect(canCreate(user)).toBe(true);
    expect(canEdit(user)).toBe(true);
    expect(canDelete(user)).toBe(false);
  });

  it('FULL_ACCESS can create, edit and delete', () => {
    const user = makeUser({ privilege: 'FULL_ACCESS' });
    expect(canCreate(user)).toBe(true);
    expect(canEdit(user)).toBe(true);
    expect(canDelete(user)).toBe(true);
  });

  it('admins can do everything', () => {
    const user = makeUser({ role: 'admin' });
    expect(canCreate(user)).toBe(true);
    expect(canEdit(user)).toBe(true);
    expect(canDelete(user)).toBe(true);
  });

  it('missing privilege (non-admin) defaults to full access', () => {
    const user = makeUser({ role: 'user' });
    expect(canCreate(user)).toBe(true);
    expect(canDelete(user)).toBe(true);
  });
});
