import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, signToken } from '../test/helpers';
import { buildPrismaMock } from '../test/prismaMock';
import adminRouter from '../../src/routes/adminRoutes';
import { sendUserCreatedEmail } from '../../src/services/emailService';

vi.mock('../../src/services/emailService', () => ({
  sendPasswordResetEmail: vi.fn(async () => true),
  sendUserCreatedEmail: vi.fn(async () => true)
}));

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../../src/config/prisma', async () => ({ prisma: prismaMock }));

function dbUser(overrides: Record<string, any> = {}) {
  return {
    id: 'admin-1',
    email: 'admin@arsii.org',
    name: 'Admin',
    role: 'ADMIN',
    privilege: 'FULL_ACCESS',
    tokenVersion: 0,
    mustChangePassword: false,
    avatarUrl: null,
    lastLogin: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides
  };
}

function adminApp(role = 'admin') {
  const token = signToken({
    id: role === 'admin' ? 'admin-1' : 'user-1',
    email: role === 'admin' ? 'admin@arsii.org' : 'user@arsii.org',
    name: role === 'admin' ? 'Admin' : 'User',
    role,
    privilege: role === 'admin' ? 'FULL_ACCESS' : 'READ',
    tokenVersion: 0
  });
  return buildTestApp((app) => {
    app.use((req: any, _res: any, next: any) => {
      req.headers.authorization = `Bearer ${token}`;
      next();
    });
    app.use('/api/admin', adminRouter);
  });
}

describe('Admin', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
    prismaMock.user.findUnique.mockResolvedValue(dbUser());
    vi.mocked(sendUserCreatedEmail).mockResolvedValue(true);
  });

  it('refuse l’accès à un utilisateur non-admin (403)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ id: 'user-1', email: 'user@arsii.org', role: 'USER', privilege: 'READ' }));
    const res = await request(adminApp('user')).get('/api/admin/users');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('liste les utilisateurs (rôles normalisés)', async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([
      dbUser(),
      dbUser({ id: 'u2', role: 'USER', privilege: 'READ_WRITE' })
    ]);
    const res = await request(adminApp()).get('/api/admin/users');
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.users[0].role).toBe('admin');
    expect(res.body.users[1].privilege).toBe('READ_WRITE');
  });

  it('refuse la création sans nom ou email (400)', async () => {
    const res = await request(adminApp()).post('/api/admin/users').send({ name: 'Awa' });
    expect(res.status).toBe(400);
  });

  it('refuse la création avec un email invalide (400)', async () => {
    const res = await request(adminApp()).post('/api/admin/users').send({ name: 'Awa', email: 'pas-un-email' });
    expect(res.status).toBe(400);
  });

  it('refuse la création si l’email existe déjà (400)', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser());
    const res = await request(adminApp()).post('/api/admin/users').send({ name: 'Awa', email: 'awa@arsii.org' });
    expect(res.status).toBe(400);
  });

  it('refuse un privilège invalide (400)', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser()).mockResolvedValueOnce(null);
    const res = await request(adminApp()).post('/api/admin/users').send({ name: 'Awa', email: 'awa@arsii.org', privilege: 'SUPER' });
    expect(res.status).toBe(400);
  });

  it('crée un utilisateur avec mot de passe temporaire et envoie l’email', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser()).mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce({ id: 'u9', email: 'awa@arsii.org', name: 'Awa Diop', role: 'USER', privilege: null, createdAt: new Date('2026-01-01') });
    const res = await request(adminApp()).post('/api/admin/users').send({ name: 'Awa Diop', email: 'awa@arsii.org' });
    expect(res.status).toBe(201);
    expect(res.body.temporaryPassword).toMatch(/^Temp[0-9a-z]{8}!$/);
    expect(res.body.user.role).toBe('USER');
    expect(sendUserCreatedEmail).toHaveBeenCalledWith('awa@arsii.org', 'Awa Diop', expect.stringMatching(/^Temp[0-9a-z]{8}!$/));
  });

  it('refuse une mise à jour sans modification (400)', async () => {
    const res = await request(adminApp()).put('/api/admin/users/u2').send({});
    expect(res.status).toBe(400);
  });

  it('refuse un privilège invalide en mise à jour (400)', async () => {
    const res = await request(adminApp()).put('/api/admin/users/u2').send({ privilege: 'NOPE' });
    expect(res.status).toBe(400);
  });

  it('interdit de retirer son propre rôle admin (400)', async () => {
    const res = await request(adminApp()).put('/api/admin/users/admin-1').send({ role: 'user' });
    expect(res.status).toBe(400);
  });

  it('met à jour le privilège d’un utilisateur', async () => {
    prismaMock.user.update.mockResolvedValueOnce(dbUser({ id: 'u2', email: 'u2@arsii.org', role: 'USER', privilege: 'READ' }));
    const res = await request(adminApp()).put('/api/admin/users/u2').send({ privilege: 'READ' });
    expect(res.status).toBe(200);
    expect(res.body.user.privilege).toBe('READ');
  });

  it('renvoie 404 si l’utilisateur mis à jour n’existe pas', async () => {
    prismaMock.user.update.mockRejectedValueOnce(Object.assign(new Error('Not found'), { code: 'P2025' }));
    const res = await request(adminApp()).put('/api/admin/users/ghost').send({ privilege: 'READ' });
    expect(res.status).toBe(404);
  });

  it('interdit de supprimer son propre compte (400)', async () => {
    const res = await request(adminApp()).delete('/api/admin/users/admin-1');
    expect(res.status).toBe(400);
  });

  it('supprime un utilisateur', async () => {
    prismaMock.user.delete.mockResolvedValueOnce({ id: 'u2' });
    const res = await request(adminApp()).delete('/api/admin/users/u2');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deletedId).toBe('u2');
  });

  it('renvoie 404 si l’utilisateur à supprimer n’existe pas', async () => {
    prismaMock.user.delete.mockRejectedValueOnce(Object.assign(new Error('Not found'), { code: 'P2025' }));
    const res = await request(adminApp()).delete('/api/admin/users/ghost');
    expect(res.status).toBe(404);
  });

  it('renvoie 500 si la liste échoue', async () => {
    prismaMock.user.findMany.mockRejectedValueOnce(new Error('db down'));
    const res = await request(adminApp()).get('/api/admin/users');
    expect(res.status).toBe(500);
  });

  it('renvoie 500 si la vérification de doublon échoue', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser()).mockRejectedValueOnce(new Error('db down'));
    const res = await request(adminApp()).post('/api/admin/users').send({ name: 'Awa', email: 'awa@arsii.org' });
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('vérification');
  });

  it('journalise l’échec d’envoi de l’email mais crée quand même (201)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser()).mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce({ id: 'u9', email: 'awa@arsii.org', name: 'Awa Diop', role: 'USER', privilege: null, createdAt: new Date('2026-01-01') });
    vi.mocked(sendUserCreatedEmail).mockRejectedValueOnce(new Error('mail down'));
    const res = await request(adminApp()).post('/api/admin/users').send({ name: 'Awa Diop', email: 'awa@arsii.org' });
    expect(res.status).toBe(201);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('renvoie 400 si la création échoue sur un doublon concurrent (P2002)', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser()).mockResolvedValueOnce(null);
    prismaMock.user.create.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
    const res = await request(adminApp()).post('/api/admin/users').send({ name: 'Awa', email: 'awa@arsii.org' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('existe déjà');
  });

  it('renvoie 500 si la création échoue en base', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser()).mockResolvedValueOnce(null);
    prismaMock.user.create.mockRejectedValueOnce(new Error('db down'));
    const res = await request(adminApp()).post('/api/admin/users').send({ name: 'Awa', email: 'awa@arsii.org' });
    expect(res.status).toBe(500);
  });

  it('refuse un rôle invalide en mise à jour (400)', async () => {
    const res = await request(adminApp()).put('/api/admin/users/u2').send({ role: 'boss' });
    expect(res.status).toBe(400);
  });

  it('renvoie 500 si la mise à jour échoue en base', async () => {
    prismaMock.user.update.mockRejectedValueOnce(new Error('db down'));
    const res = await request(adminApp()).put('/api/admin/users/u2').send({ privilege: 'READ' });
    expect(res.status).toBe(500);
  });

  it('renvoie 500 si la suppression échoue en base', async () => {
    prismaMock.user.delete.mockRejectedValueOnce(new Error('db down'));
    const res = await request(adminApp()).delete('/api/admin/users/u2');
    expect(res.status).toBe(500);
  });
});