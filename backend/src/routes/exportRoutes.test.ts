import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, signToken } from '../test/helpers';
import { buildPrismaMock } from '../test/prismaMock';
import exportRouter from '../routes/exportRoutes';

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../config/prisma', async () => ({ prisma: prismaMock }));

function appWithAuth() {
  const token = signToken({
    id: 'u1',
    email: 'user@arsii.org',
    name: 'User',
    role: 'user',
    privilege: 'READ_WRITE',
    tokenVersion: 0
  });
  return buildTestApp((app) => {
    app.use((req: any, _res: any, next: any) => {
      req.headers.authorization = `Bearer ${token}`;
      next();
    });
    app.use('/api/export', exportRouter);
  });
}

describe('Export & logs', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      tokenVersion: 0,
      role: 'USER',
      privilege: 'READ_WRITE'
    });
  });

  it('journalise un export (200)', async () => {
    prismaMock.importExportLog.create.mockResolvedValueOnce({
      id: 'l1',
      type: 'EXPORT',
      format: 'EXPORT',
      fileName: 'contacts.csv',
      recordCount: 12,
      performedBy: 'User'
    });
    const res = await request(appWithAuth()).post('/api/export/log').send({ format: 'CSV', fileName: 'contacts.csv', recordCount: 12 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.log.recordCount).toBe(12);
  });

  it('renvoie un format par défaut sans valeur (200)', async () => {
    const res = await request(appWithAuth()).post('/api/export/log').send({});
    expect(res.status).toBe(200);
    expect(prismaMock.importExportLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ format: 'CSV', type: 'EXPORT' }) })
    );
  });

  it('liste l’historique des imports sur la période par défaut (200)', async () => {
    prismaMock.importExportLog.findMany.mockResolvedValueOnce([
      { createdAt: new Date('2026-08-29T10:00:00Z'), fileName: 'import.csv', recordCount: 5, status: 'success', performedBy: 'User' }
    ]);
    const res = await request(appWithAuth()).get('/api/export/log');
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(1);
    expect(res.body.data.records[0].date).toBe('2026-08-29');
    expect(prismaMock.importExportLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: 'IMPORT' }) })
    );
  });

  it('filtre l’historique sur la période week (200)', async () => {
    const res = await request(appWithAuth()).get('/api/export/log?period=week');
    expect(res.status).toBe(200);
    expect(prismaMock.importExportLog.findMany).toHaveBeenCalled();
  });
});