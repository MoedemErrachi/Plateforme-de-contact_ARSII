import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../test/helpers';
import { buildPrismaMock } from '../test/prismaMock';
import healthRouter from '../routes/healthRoutes';

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../config/prisma', async () => ({ prisma: prismaMock }));

describe('Health', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
  });

  it('renvoie healthy quand la base répond (200)', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const res = await request(buildTestApp((app) => app.use('/api/health', healthRouter))).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.database).toBe('connected');
  });

  it('renvoie 503 quand la base est indisponible', async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(buildTestApp((app) => app.use('/api/health', healthRouter))).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.database).toBe('disconnected');
  });
});