import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../test/helpers';
import { buildPrismaMock } from '../test/prismaMock';
import dashboardRouter from '../../src/routes/dashboardRoutes';

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../../src/config/prisma', async () => ({ prisma: prismaMock }));

describe('Dashboard', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
  });

  it('renvoie les indicateurs du tableau de bord (200)', async () => {
    const res = await request(buildTestApp((app) => app.use('/api/dashboard', dashboardRouter))).get('/api/dashboard/stats');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.kpis.totalContacts).toBe(0);
    expect(Array.isArray(res.body.data.distributionByCountry)).toBe(true);
    expect(res.body.data.countryLabels.length).toBeGreaterThan(190);
  });

  it('renvoie les répartitions remplies (200)', async () => {
    prismaMock.contact.count.mockResolvedValueOnce(100);
    prismaMock.contact.groupBy
      .mockResolvedValueOnce([{ countryOfOrigin: 'Sénégal', _count: { id: 40 } }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prismaMock.tagOnContact.groupBy.mockResolvedValueOnce([]);
    const res = await request(buildTestApp((app) => app.use('/api/dashboard', dashboardRouter))).get('/api/dashboard/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.kpis.totalContacts).toBe(100);
    expect(res.body.data.distributionByCountry[0].percentage).toBe(40);
  });
});