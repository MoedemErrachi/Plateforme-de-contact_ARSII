import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../test/helpers';
import { buildPrismaMock } from '../test/prismaMock';
import statsRouter from '../routes/statsRoutes';

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../config/prisma', async () => ({ prisma: prismaMock }));

describe('Stats - agrégation', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
  });

  it('refuse un group_by manquant (400)', async () => {
    const res = await request(buildTestApp((app) => app.use('/api/stats', statsRouter))).get('/api/stats/aggregation');
    expect(res.status).toBe(400);
  });

  it('agrège par genre (200)', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { label: 'FEMALE', n: 12n },
      { label: 'MALE', n: 8n }
    ]);
    const res = await request(buildTestApp((app) => app.use('/api/stats', statsRouter))).get('/api/stats/aggregation?group_by=gender');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ FEMALE: 12, MALE: 8 });
  });

  it('agrège en gérant les valeurs nulles (200)', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ label: null, n: 3n }]);
    const res = await request(buildTestApp((app) => app.use('/api/stats', statsRouter))).get('/api/stats/aggregation?group_by=countryOfOrigin');
    expect(res.status).toBe(200);
    expect(res.body['Non renseigné']).toBe(3);
  });
});