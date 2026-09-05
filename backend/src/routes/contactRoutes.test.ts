import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../config/prisma', async () => {
  const { buildPrismaMock } = await import('../test/prismaMock');
  buildPrismaMock(prismaMock);
  return { prisma: prismaMock };
});

import { buildTestApp, signToken } from '../test/helpers';
import { buildPrismaMock } from '../test/prismaMock';
import contactRouter from '../routes/contactRoutes';
import { authenticateJWT } from '../middleware/authenticateJWT';

function appWithRole(role: string, privilege?: string) {
  const token = signToken({
    id: 'u1',
    email: 'user@arsii.org',
    name: 'User',
    role,
    privilege: role === 'admin' ? 'FULL_ACCESS' : privilege,
    tokenVersion: 0
  });
  return buildTestApp((app) => {
    app.use((req: any, _res: any, next: any) => {
      req.headers.authorization = `Bearer ${token}`;
      next();
    });
    app.use('/api/contacts', authenticateJWT);
    app.use('/api/contacts', contactRouter);
  });
}

function mockDbUser(role: string, privilege?: string) {
  prismaMock.user.findUnique.mockResolvedValue({
    id: 'u1',
    tokenVersion: 0,
    role,
    privilege: role === 'admin' ? 'FULL_ACCESS' : privilege ?? null
  });
}

describe('GET /api/contacts', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
    mockDbUser('user', 'READ_WRITE');
  });

  it('liste les contacts paginés', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ n: 10n }])
      .mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }]);
    prismaMock.contact.findMany.mockResolvedValueOnce([
      { id: 'c1', firstName: 'Awa' },
      { id: 'c2', firstName: 'Moussa' }
    ]);
    const res = await request(appWithRole('user', 'READ')).get('/api/contacts?page=1&limit=20');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.contacts).toHaveLength(2);
    expect(res.body.pagination.totalCount).toBe(10);
    expect(res.body.pagination.totalPages).toBe(1);
  });

  it('supporte la pagination sans résultats', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ n: 0n }]).mockResolvedValueOnce([]);
    prismaMock.contact.findMany.mockResolvedValueOnce([]);
    const res = await request(appWithRole('user', 'READ')).get('/api/contacts?page=9');
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(9);
  });
});

describe('POST /api/contacts', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
    mockDbUser('user', 'READ_WRITE');
  });

  it('crée un contact (201)', async () => {
    prismaMock.contact.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'c1', email: 'awa@mail.sn', firstName: 'Awa' });
    prismaMock.contact.create.mockResolvedValueOnce({ id: 'c1' });
    const res = await request(appWithRole('user', 'READ_WRITE'))
      .post('/api/contacts')
      .send({ email: 'awa@mail.sn', fullName: 'Awa Diop' });
    expect(res.status).toBe(201);
    expect(res.body.data.contact.id).toBe('c1');
  });

  it('refuse un corps invalide (400) via le validateur', async () => {
    const res = await request(appWithRole('user', 'READ_WRITE'))
      .post('/api/contacts')
      .send({ fullName: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Validation invalide');
  });

  it('refuse l’accès sans privilège d’écriture (403)', async () => {
    mockDbUser('user', 'READ');
    const res = await request(appWithRole('user', 'READ'))
      .post('/api/contacts')
      .send({ email: 'awa@mail.sn' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});

describe('GET/PUT/DELETE /api/contacts/:id', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
    mockDbUser('user', 'READ_WRITE');
  });

  it('récupère un contact', async () => {
    prismaMock.contact.findUnique.mockResolvedValueOnce({ id: 'c1', firstName: 'Awa' });
    const res = await request(appWithRole('user', 'READ')).get('/api/contacts/c1');
    expect(res.status).toBe(200);
    expect(res.body.data.contact.id).toBe('c1');
  });

  it('met à jour un contact', async () => {
    prismaMock.contact.findUnique.mockResolvedValueOnce({ id: 'c1', email: 'awa@mail.sn' });
    prismaMock.contact.update.mockResolvedValueOnce({ id: 'c1', firstName: 'Aminata' });
    const res = await request(appWithRole('user', 'READ_WRITE'))
      .put('/api/contacts/c1')
      .send({ firstName: 'Aminata' });
    expect(res.status).toBe(200);
    expect(res.body.data.contact.firstName).toBe('Aminata');
  });

  it('refuse une mise à jour avec un email invalide (400)', async () => {
    const res = await request(appWithRole('user', 'READ_WRITE'))
      .put('/api/contacts/c1')
      .send({ email: 'pas-un-email' });
    expect(res.status).toBe(400);
  });

  it('refuse la suppression sans FULL_ACCESS (403)', async () => {
    const res = await request(appWithRole('user', 'READ_WRITE')).delete('/api/contacts/c1');
    expect(res.status).toBe(403);
  });

  it('supprime un contact (FULL_ACCESS)', async () => {
    mockDbUser('admin');
    prismaMock.contact.findUnique.mockResolvedValueOnce({ id: 'c1' });
    prismaMock.contact.delete.mockResolvedValueOnce({ id: 'c1' });
    const res = await request(appWithRole('admin')).delete('/api/contacts/c1');
    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
  });

  it('lève 404 si le contact est introuvable', async () => {
    prismaMock.contact.findUnique.mockResolvedValueOnce(null);
    const res = await request(appWithRole('user', 'READ')).get('/api/contacts/ghost');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/contacts/bulk', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
    mockDbUser('user', 'READ_WRITE');
  });

  it('importe des contacts et journalise (200)', async () => {
    prismaMock.contact.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: 'c1', email: 'one@mail.sn' }
    ]);
    prismaMock.contact.createMany.mockResolvedValueOnce({ count: 1 });

    const res = await request(appWithRole('admin'))
      .post('/api/contacts/bulk')
      .send({ newContacts: [{ email: 'one@mail.sn', fullName: 'Un' }], updatedContacts: [] });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.data.createdCount).toBe(1);
    expect(prismaMock.importExportLog.create).toHaveBeenCalled();
  });

  it('refuse un payload vide via le validateur (400)', async () => {
    const res = await request(appWithRole('admin'))
      .post('/api/contacts/bulk')
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/contacts/bulk/preview', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
    mockDbUser('user', 'READ_WRITE');
  });

  it('prévisualise l’import', async () => {
    prismaMock.contact.findMany.mockResolvedValueOnce([{ id: 'c1', email: 'dup@mail.sn' }]);
    const res = await request(appWithRole('admin'))
      .post('/api/contacts/bulk/preview')
      .send({ rows: [{ email: 'dup@mail.sn' }, { email: 'new@mail.sn' }] });
    expect(res.status).toBe(200);
    expect(res.body.data.summary.duplicateCount).toBe(1);
    expect(res.body.data.summary.validCount).toBe(1);
  });
});

describe('DELETE /api/contacts/bulk', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
    mockDbUser('user', 'READ_WRITE');
  });

  it('supprime en lot', async () => {
    mockDbUser('admin');
    prismaMock.contact.deleteMany.mockResolvedValueOnce({ count: 2 });
    const res = await request(appWithRole('admin'))
      .delete('/api/contacts/bulk')
      .send({ ids: ['c1', 'c2'] });
    expect(res.status).toBe(200);
    expect(res.body.data.deletedCount).toBe(2);
  });

  it('refuse un lot sans ids (400)', async () => {
    mockDbUser('admin');
    const res = await request(appWithRole('admin')).delete('/api/contacts/bulk').send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/contacts/export', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
    mockDbUser('user', 'READ_WRITE');
  });

  it('exporte en CSV', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ n: 1n }]).mockResolvedValueOnce([{ id: 'c1' }]);
    prismaMock.contact.findMany.mockResolvedValueOnce([{ id: 'c1', email: 'awa@mail.sn', tags: [] }]);
    const res = await request(appWithRole('user', 'READ'))
      .get('/api/contacts/export?format=csv&includeTags=true');
    expect(res.status).toBe(200);
    expect(res.headers['x-export-count']).toBe('1');
    expect(res.headers['content-disposition']).toContain('.csv');
    expect(res.text).toContain('Email');
  });

  it('exporte en JSON avec colonnes sélectionnées', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ n: 1n }]).mockResolvedValueOnce([{ id: 'c1' }]).mockResolvedValueOnce([]);
    prismaMock.contact.findMany.mockResolvedValueOnce([
      { id: 'c1', email: 'awa@mail.sn', firstName: 'Awa', tags: [{ tag: { name: 'Mobilité' } }] }
    ]);
    const res = await request(appWithRole('user', 'READ'))
      .get('/api/contacts/export?format=json&fields=email&includeTags=true');
    expect(res.status).toBe(200);
    expect(res.body.data.contacts[0].email).toBe('awa@mail.sn');
    expect(res.body.data.contacts[0].tags).toEqual(['Mobilité']);
  });

  it('exporte en XLSX', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ n: 1n }]).mockResolvedValueOnce([{ id: 'c1' }]).mockResolvedValueOnce([]);
    prismaMock.contact.findMany.mockResolvedValueOnce([{ id: 'c1', email: 'awa@mail.sn' }]);
    const res = await request(appWithRole('user', 'READ'))
      .get('/api/contacts/export?format=xlsx');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  });

  it('avertit pour les gros exports sans planter', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ n: 6000n }]).mockResolvedValueOnce([{ id: 'c1' }]).mockResolvedValueOnce([]);
    prismaMock.contact.findMany.mockResolvedValueOnce([]);
    const res = await request(appWithRole('user', 'READ')).get('/api/contacts/export?format=json');
    expect(res.status).toBe(200);
    expect(Number(res.headers['x-export-count'])).toBeGreaterThan(5000);
  });
});

describe('GET /api/contacts/countries & /count', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
    mockDbUser('user', 'READ_WRITE');
  });

  it('liste les pays distincts', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ country: 'Sénégal' }]);
    const res = await request(appWithRole('user', 'READ')).get('/api/contacts/countries');
    expect(res.status).toBe(200);
    expect(res.body.data.countries).toEqual(['Sénégal']);
  });

  it('compte selon un motif d’email', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ n: 3n }]);
    const res = await request(appWithRole('user', 'READ')).get('/api/contacts/count?email_pattern=ucad.sn');
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(3);
  });

  it('refuse un motif manquant (400)', async () => {
    const res = await request(appWithRole('user', 'READ')).get('/api/contacts/count');
    expect(res.status).toBe(400);
  });
});