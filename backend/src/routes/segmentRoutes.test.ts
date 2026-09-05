import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../test/helpers';
import { buildPrismaMock } from '../test/prismaMock';
import segmentRouter from '../routes/segmentRoutes';

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../config/prisma', async () => ({ prisma: prismaMock }));

function appWithPrivilege(privilege: string) {
  return buildTestApp((app) => {
    app.use((req: any, _res: any, next: any) => {
      req.user = { id: 'u1', email: 'user@arsii.org', name: 'User', role: 'user', privilege, tokenVersion: 0 };
      next();
    });
    app.use('/api/segments', segmentRouter);
  });
}

describe('Segments & Tags', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
  });

  it('liste les segments avec comptage des membres (200)', async () => {
    prismaMock.segment.findMany.mockResolvedValueOnce([{ id: 's1', name: 'UCAD', filters: {}, createdAt: new Date('2026-01-01') }]);
    prismaMock.tag.findMany.mockResolvedValueOnce([{ id: 't1', name: 'Mobilité' }]);
    prismaMock.contact.count.mockResolvedValueOnce(5);
    const res = await request(appWithPrivilege('READ')).get('/api/segments');
    expect(res.status).toBe(200);
    expect(res.body.data.segments[0].memberCount).toBe(5);
    expect(res.body.data.tags).toHaveLength(1);
  });

  it('refuse la création d’un segment sans nom (400)', async () => {
    const res = await request(appWithPrivilege('READ_WRITE')).post('/api/segments').send({});
    expect(res.status).toBe(400);
  });

  it('crée un segment (201)', async () => {
    prismaMock.segment.create.mockResolvedValueOnce({ id: 's2', name: 'Chercheurs UCAD', filters: {}, createdAt: new Date('2026-01-01') });
    const res = await request(appWithPrivilege('READ_WRITE'))
      .post('/api/segments')
      .send({ name: 'Chercheurs UCAD', filters: {} });
    expect(res.status).toBe(201);
    expect(res.body.data.segment.name).toBe('Chercheurs UCAD');
  });

  it('refuse un segment sans privilège d’écriture (403)', async () => {
    const res = await request(appWithPrivilege('READ')).post('/api/segments').send({ name: 'Seg', description: 'x' });
    expect(res.status).toBe(403);
  });

  it('met à jour un segment (200)', async () => {
    prismaMock.segment.findUnique.mockResolvedValueOnce({ id: 's1', name: 'UCAD' });
    prismaMock.segment.update.mockResolvedValueOnce({ id: 's1', name: 'UCAD 2', filters: {}, createdAt: new Date('2026-01-01') });
    const res = await request(appWithPrivilege('READ_WRITE')).put('/api/segments/s1').send({ name: 'UCAD 2' });
    expect(res.status).toBe(200);
    expect(res.body.data.segment.name).toBe('UCAD 2');
  });

  it('renvoie 404 si le segment à mettre à jour n’existe pas', async () => {
    prismaMock.segment.findUnique.mockResolvedValueOnce(null);
    const res = await request(appWithPrivilege('READ_WRITE')).put('/api/segments/ghost').send({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it('supprime un segment (200)', async () => {
    prismaMock.segment.findUnique.mockResolvedValueOnce({ id: 's1', name: 'UCAD' });
    prismaMock.segment.delete.mockResolvedValueOnce({ id: 's1' });
    const res = await request(appWithPrivilege('FULL_ACCESS')).delete('/api/segments/s1');
    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
  });

  it('liste les étiquettes (200)', async () => {
    prismaMock.tag.findMany.mockResolvedValueOnce([
      { id: 't1', name: 'Mobilité', _count: { contacts: 3 } }
    ]);
    const res = await request(appWithPrivilege('READ')).get('/api/segments/tags');
    expect(res.status).toBe(200);
    expect(res.body.data.tags).toHaveLength(1);
  });

  it('crée une étiquette (201)', async () => {
    prismaMock.tag.create.mockResolvedValueOnce({ id: 't2', name: 'Chercheur invité', color: 'bg-blue-100' });
    const res = await request(appWithPrivilege('READ_WRITE')).post('/api/segments/tags').send({ name: 'Chercheur invité' });
    expect(res.status).toBe(201);
    expect(res.body.data.tag.name).toBe('Chercheur invité');
  });

  it('met à jour une étiquette (200)', async () => {
    prismaMock.tag.update.mockResolvedValueOnce({ id: 't1', name: 'Mobilité interne', color: 'bg-blue-100' });
    const res = await request(appWithPrivilege('READ_WRITE')).put('/api/segments/tags/t1').send({ name: 'Mobilité interne' });
    expect(res.status).toBe(200);
    expect(res.body.data.tag.name).toBe('Mobilité interne');
  });

  it('supprime une étiquette (200)', async () => {
    prismaMock.tag.delete.mockResolvedValueOnce({ id: 't1', name: 'Mobilité' });
    const res = await request(appWithPrivilege('FULL_ACCESS')).delete('/api/segments/tags/t1');
    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
  });

  it('affecte des contacts à une étiquette (200)', async () => {
    prismaMock.tag.findUnique.mockResolvedValueOnce({ id: 't1', name: 'Mobilité' });
    prismaMock.tag.findUniqueOrThrow.mockResolvedValueOnce({ id: 't1', name: 'Mobilité', contacts: [], _count: { contacts: 2 } });
    const res = await request(appWithPrivilege('READ_WRITE'))
      .put('/api/segments/tags/t1/contacts')
      .send({ contactIds: ['c1', 'c2'] });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(prismaMock.tagOnContact.deleteMany).toHaveBeenCalled();
  });

  it('refuse une affectation sans contactIds (400)', async () => {
    const res = await request(appWithPrivilege('READ_WRITE')).put('/api/segments/tags/t1/contacts').send({});
    expect(res.status).toBe(400);
  });
});