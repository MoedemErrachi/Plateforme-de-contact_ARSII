import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../test/helpers';
import { buildPrismaMock } from '../test/prismaMock';
import searchRouter from '../routes/searchRoutes';

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../config/prisma', async () => ({ prisma: prismaMock }));

function appWithUser(user?: { id: string }) {
  return buildTestApp((app) => {
    app.use((req: any, _res: any, next: any) => {
      if (user) {
        req.user = { id: user.id, email: 'user@arsii.org', name: 'User', role: 'user', privilege: 'READ_WRITE', tokenVersion: 0 };
      }
      next();
    });
    app.use('/api/searches', searchRouter);
  });
}

describe('Recherches sauvegardées', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
  });

  it('exige un utilisateur authentifié (401)', async () => {
    const res = await request(appWithUser()).get('/api/searches');
    expect(res.status).toBe(401);
  });

  it('liste les recherches de l’utilisateur (200)', async () => {
    prismaMock.savedSearch.findMany.mockResolvedValueOnce([
      { id: 's1', name: 'Doctorants', filters: { search: 'x' }, userId: 'u1', createdAt: new Date('2026-01-01') }
    ]);
    const res = await request(appWithUser({ id: 'u1' })).get('/api/searches');
    expect(res.status).toBe(200);
    expect(res.body.data.searches).toHaveLength(1);
    expect(prismaMock.savedSearch.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u1' } }));
  });

  it('refuse une sauvegarde sans nom (400)', async () => {
    const res = await request(appWithUser({ id: 'u1' })).post('/api/searches').send({ filters: {} });
    expect(res.status).toBe(400);
  });

  it('sauvegarde une recherche (201)', async () => {
    prismaMock.savedSearch.create.mockResolvedValueOnce({ id: 's2', name: 'Postdocs Mali', filters: { search: 'Mali' }, userId: 'u1', createdAt: new Date('2026-01-01') });
    const res = await request(appWithUser({ id: 'u1' })).post('/api/searches').send({ name: 'Postdocs Mali', filters: { search: 'Mali' } });
    expect(res.status).toBe(201);
    expect(res.body.data.search.name).toBe('Postdocs Mali');
  });

  it('supprime sa propre recherche (200)', async () => {
    prismaMock.savedSearch.findUnique.mockResolvedValueOnce({ id: 's1', userId: 'u1' });
    prismaMock.savedSearch.delete.mockResolvedValueOnce({ id: 's1' });
    const res = await request(appWithUser({ id: 'u1' })).delete('/api/searches/s1');
    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
  });

  it('renvoie 404 si la recherche appartient à un autre utilisateur', async () => {
    prismaMock.savedSearch.findUnique.mockResolvedValueOnce({ id: 's1', userId: 'autre' });
    const res = await request(appWithUser({ id: 'u1' })).delete('/api/searches/s1');
    expect(res.status).toBe(404);
  });

  it('renvoie 500 si la sauvegarde échoue en base', async () => {
    prismaMock.savedSearch.create.mockRejectedValueOnce(new Error('db down'));
    const res = await request(appWithUser({ id: 'u1' })).post('/api/searches').send({ name: 'X', filters: {} });
    expect(res.status).toBe(500);
  });
});