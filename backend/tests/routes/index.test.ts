import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../test/helpers';
import { buildPrismaMock } from '../test/prismaMock';
import { buildSupabaseMock } from '../test/supabaseMock';
import { buildEmailMock } from '../test/emailMock';

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../../src/config/prisma', async () => ({ prisma: prismaMock }));

const supabaseMock = vi.hoisted(() => ({} as any));
vi.mock('../../src/config/supabase', async () => {
  const { buildSupabaseMock } = await import('../test/supabaseMock');
  return { supabase: buildSupabaseMock(supabaseMock) };
});

const emailMock = vi.hoisted(() => ({} as any));
vi.mock('../../src/services/emailService', async () => {
  const { buildEmailMock } = await import('../test/emailMock');
  return buildEmailMock(emailMock);
});

import apiRouter from '../../src/routes/index';

function rootApp() {
  return buildTestApp(app => app.use('/api', apiRouter));
}

describe('API router monté (routes/index)', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
  });

  it('route /api/health au travers du routeur principal', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const res = await request(rootApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('connected');
  });

  it('expose /api/auth (validation du login)', async () => {
    const res = await request(rootApp()).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email et mot de passe requis.');
  });

  it('protège /api/admin par authentification', async () => {
    const res = await request(rootApp()).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('renvoie 404 pour un chemin inconnu', async () => {
    const res = await request(rootApp()).get('/api/nope');
    expect(res.status).toBe(404);
  });
});