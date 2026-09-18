import { describe, expect, it, vi, beforeAll } from 'vitest';
import type { Response, NextFunction } from 'express';

// Mock the prisma config so importing authenticateJWT (transitive dependency of
// authorizeRole) does not try to instantiate a real PrismaClient.
vi.mock('../../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { authorizeRole, requirePrivilege } from '../../src/middleware/authorizeRole';
import type { AuthenticatedRequest } from '../../src/middleware/authenticateJWT';

function makeReq(user?: AuthenticatedRequest['user']): AuthenticatedRequest {
  return { user } as AuthenticatedRequest;
}

function makeRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as unknown as Response;
}

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

describe('authorizeRole', () => {
  it('calls next when the user has one of the allowed roles', () => {
    const next = vi.fn();
    const middleware = authorizeRole('admin', 'manager');
    middleware(makeReq({ role: 'admin' } as AuthenticatedRequest['user']), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects with 403 when role is not allowed', () => {
    const res = makeRes();
    const middleware = authorizeRole('admin');
    middleware(makeReq({ role: 'user' } as AuthenticatedRequest['user']), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalled();
  });

  it('rejects with 403 when the user has no role', () => {
    const res = makeRes();
    const middleware = authorizeRole('admin');
    middleware(makeReq(undefined), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('requirePrivilege', () => {
  it('always lets admins through', () => {
    const next = vi.fn();
    requirePrivilege('FULL_ACCESS')(makeReq({ role: 'admin' } as AuthenticatedRequest['user']), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('lets a user with sufficient privilege pass', () => {
    const next = vi.fn();
    requirePrivilege('READ')(makeReq({ role: 'user', privilege: 'READ_WRITE' } as AuthenticatedRequest['user']), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects with 403 when privilege is insufficient', () => {
    const res = makeRes();
    requirePrivilege('FULL_ACCESS')(makeReq({ role: 'user', privilege: 'READ' } as AuthenticatedRequest['user']), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects with 403 when no privilege is set', () => {
    const res = makeRes();
    requirePrivilege('READ')(makeReq({ role: 'user' } as AuthenticatedRequest['user']), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
