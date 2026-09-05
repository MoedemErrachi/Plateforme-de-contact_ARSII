import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { buildTestApp, signToken } from '../test/helpers';
import { buildPrismaMock } from '../test/prismaMock';
import authRouter from '../routes/authRoutes';
import { sendPasswordResetEmail } from '../services/emailService';

vi.mock('../services/emailService', () => ({
  sendPasswordResetEmail: vi.fn(async () => true)
}));

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../config/prisma', async () => ({ prisma: prismaMock }));

const PASSWORD_HASH = bcrypt.hashSync('motdepasse123', 4);

function dbUser(overrides: Record<string, any> = {}) {
  return {
    id: 'u1',
    email: 'user@arsii.org',
    name: 'User',
    role: 'USER',
    privilege: 'READ_WRITE',
    passwordHash: PASSWORD_HASH,
    mustChangePassword: false,
    tokenVersion: 0,
    avatarUrl: null,
    lastLogin: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides
  };
}

function authApp() {
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
    app.use('/api/auth', authRouter);
  });
}

describe('Auth - endpoints publics', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
    vi.mocked(sendPasswordResetEmail).mockResolvedValue(true);
  });

  it('émet un token CSRF', async () => {
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter))).get('/api/auth/csrf-token');
    expect(res.status).toBe(200);
    expect(typeof res.body.csrfToken).toBe('string');
    expect(res.body.csrfToken.length).toBeGreaterThan(10);
  });

  it('login refuse des identifiants manquants (400)', async () => {
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter)))
      .post('/api/auth/login')
      .send({ email: 'user@arsii.org' });
    expect(res.status).toBe(400);
  });

  it('login refuse un compte inconnu (401)', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter)))
      .post('/api/auth/login')
      .send({ email: 'ghost@arsii.org', password: 'whatever' });
    expect(res.status).toBe(401);
  });

  it('login refuse un mauvais mot de passe (401)', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser());
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter)))
      .post('/api/auth/login')
      .send({ email: 'user@arsii.org', password: 'mauvais' });
    expect(res.status).toBe(401);
  });

  it('login réussit et pose le cookie + renvoie le JWT', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser({ role: 'ADMIN' }));
    prismaMock.user.update.mockResolvedValueOnce(dbUser({ role: 'ADMIN' }));
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter)))
      .post('/api/auth/login')
      .send({ email: 'user@arsii.org', password: 'motdepasse123', rememberMe: true });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.privilege).toBe('FULL_ACCESS');
    expect(prismaMock.user.update).toHaveBeenCalled();
  });

  it('login renvoie 500 si la base est en erreur', async () => {
    prismaMock.user.findUnique.mockRejectedValueOnce(new Error('db down'));
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter)))
      .post('/api/auth/login')
      .send({ email: 'user@arsii.org', password: 'motdepasse123' });
    expect(res.status).toBe(500);
  });

  it('forgot-password exige un email (400)', async () => {
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter)))
      .post('/api/auth/forgot-password')
      .send({});
    expect(res.status).toBe(400);
  });

  it('forgot-password avec email inconnu renvoie un message générique sans envoyer d’email', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter)))
      .post('/api/auth/forgot-password')
      .send({ email: 'ghost@arsii.org' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('forgot-password crée un jeton de réinitialisation et envoie l’email', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser());
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter)))
      .post('/api/auth/forgot-password')
      .send({ email: 'user@arsii.org' });
    expect(res.status).toBe(200);
    expect(prismaMock.passwordResetToken.updateMany).toHaveBeenCalled();
    expect(prismaMock.passwordResetToken.create).toHaveBeenCalled();
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const [to, resetUrl] = vi.mocked(sendPasswordResetEmail).mock.calls[0];
    expect(to).toBe('user@arsii.org');
    expect(String(resetUrl)).toContain('/reset-password/');
  });

  it('reset-password exige token et nouveau mot de passe (400)', async () => {
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter)))
      .post('/api/auth/reset-password')
      .send({ token: 'abc' });
    expect(res.status).toBe(400);
  });

  it('reset-password refuse un mot de passe trop court (400)', async () => {
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter)))
      .post('/api/auth/reset-password')
      .send({ token: 'abc', newPassword: 'court' });
    expect(res.status).toBe(400);
  });

  it('reset-password refuse un jeton inconnu (400)', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValueOnce(null);
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter)))
      .post('/api/auth/reset-password')
      .send({ token: 'inconnu', newPassword: 'nouveaumotdepasse' });
    expect(res.status).toBe(400);
  });

  it('reset-password refuse un jeton expiré (400)', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'p1', token: 'abc', userId: 'u1', used: false, expiresAt: new Date(Date.now() - 1000)
    });
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter)))
      .post('/api/auth/reset-password')
      .send({ token: 'abc', newPassword: 'nouveaumotdepasse' });
    expect(res.status).toBe(400);
  });

  it('reset-password réinitialise et invalide l’ancien jeton', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValueOnce({
      id: 'p1', token: 'abc', userId: 'u1', used: false, expiresAt: new Date(Date.now() + 60_000)
    });
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter)))
      .post('/api/auth/reset-password')
      .send({ token: 'abc', newPassword: 'nouveaumotdepasse' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it('forgot-password renvoie 500 si la base est en erreur', async () => {
    prismaMock.user.findUnique.mockRejectedValueOnce(new Error('db down'));
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter)))
      .post('/api/auth/forgot-password')
      .send({ email: 'user@arsii.org' });
    expect(res.status).toBe(500);
  });

  it('forgot-password journalise l’échec d’envoi mais répond quand même', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser());
    vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(new Error('mail down'));
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter)))
      .post('/api/auth/forgot-password')
      .send({ email: 'user@arsii.org' });
    expect(res.status).toBe(200);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('reset-password renvoie 500 si la base est en erreur', async () => {
    prismaMock.passwordResetToken.findUnique.mockRejectedValueOnce(new Error('db down'));
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter)))
      .post('/api/auth/reset-password')
      .send({ token: 'abc', newPassword: 'nouveaumotdepasse' });
    expect(res.status).toBe(500);
  });

  it('logout efface le cookie de session', async () => {
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter))).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const setCookie = Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'].join(';') : String(res.headers['set-cookie']);
    expect(setCookie).toContain('accessToken=');
    expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
  });
});

describe('Auth - endpoints authentifiés', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
    prismaMock.user.findUnique.mockResolvedValue(dbUser());
  });

  it('/me exige un jeton (401)', async () => {
    const res = await request(buildTestApp((app) => app.use('/api/auth', authRouter))).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('/me renvoie le profil relu depuis la base', async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ mustChangePassword: true }));
    const res = await request(authApp()).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    expect(res.body.user.email).toBe('user@arsii.org');
    expect(res.body.mustChangePassword).toBe(true);
  });

  it('/profile exige un nom (400)', async () => {
    const res = await request(authApp()).put('/api/auth/profile').send({ email: 'user@arsii.org' });
    expect(res.status).toBe(400);
  });

  it('/profile refuse un email invalide (400)', async () => {
    const res = await request(authApp()).put('/api/auth/profile').send({ name: 'Awa', email: 'pas-un-email' });
    expect(res.status).toBe(400);
  });

  it('/profile refuse un email déjà utilisé (409)', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce({ id: 'autre' });
    const res = await request(authApp()).put('/api/auth/profile').send({ name: 'Awa', email: 'autre@arsii.org' });
    expect(res.status).toBe(409);
  });

  it('/profile met à jour et ré-émet un cookie', async () => {
    prismaMock.user.update.mockResolvedValueOnce(dbUser({ name: 'Awa Diop' }));
    const res = await request(authApp()).put('/api/auth/profile').send({ name: 'Awa Diop' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.name).toBe('Awa Diop');
  });

  it('/change-password refuse un mot de passe trop court (400)', async () => {
    const res = await request(authApp()).put('/api/auth/change-password').send({ currentPassword: 'motdepasse123', newPassword: 'court' });
    expect(res.status).toBe(400);
  });

  it('/change-password exige le mot de passe actuel hors première connexion (400)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ mustChangePassword: false }));
    const res = await request(authApp()).put('/api/auth/change-password').send({ newPassword: 'nouveaumotdepasse' });
    expect(res.status).toBe(400);
  });

  it('/change-password refuse un mot de passe actuel incorrect (400)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ mustChangePassword: false }));
    const res = await request(authApp()).put('/api/auth/change-password').send({ currentPassword: 'mauvais', newPassword: 'nouveaumotdepasse' });
    expect(res.status).toBe(400);
  });

  it('/change-password réussit en première connexion sans mot de passe actuel', async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ mustChangePassword: true }));
    prismaMock.user.update.mockResolvedValueOnce(dbUser({ tokenVersion: 1 }));
    const res = await request(authApp()).put('/api/auth/change-password').send({ newPassword: 'nouveaumotdepasse' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe('string');
  });

  it('/first-login/acknowledge passe le flag mustChangePassword à false', async () => {
    prismaMock.user.update.mockResolvedValueOnce(dbUser({ mustChangePassword: false }));
    const res = await request(authApp()).post('/api/auth/first-login/acknowledge');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ mustChangePassword: false }) }));
  });

  it('/me renvoie 404 si l’utilisateur a disparu', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser()).mockResolvedValueOnce(null);
    const res = await request(authApp()).get('/api/auth/me');
    expect(res.status).toBe(404);
  });

  it('/me renvoie 500 si la base est en erreur', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(dbUser()).mockRejectedValueOnce(new Error('db down'));
    const res = await request(authApp()).get('/api/auth/me');
    expect(res.status).toBe(500);
  });

  it('/profile met à jour email et avatarUrl quand fournis', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    prismaMock.user.update.mockResolvedValueOnce(dbUser({ name: 'Awa Diop', email: 'awa@arsii.org', avatarUrl: 'http://a/ava.png' }));
    const res = await request(authApp()).put('/api/auth/profile').send({ name: 'Awa Diop', email: 'AWA@arsii.org', avatarUrl: 'http://a/ava.png' });
    expect(res.status).toBe(200);
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ email: 'awa@arsii.org' }) }));
    expect(res.body.user.avatarUrl).toBe('http://a/ava.png');
  });

  it('/profile renvoie 500 si la mise à jour échoue', async () => {
    prismaMock.user.update.mockRejectedValueOnce(new Error('db down'));
    const res = await request(authApp()).put('/api/auth/profile').send({ name: 'Awa' });
    expect(res.status).toBe(500);
  });

  it('/change-password exige un nouveau mot de passe (400)', async () => {
    const res = await request(authApp()).put('/api/auth/change-password').send({ currentPassword: 'motdepasse123' });
    expect(res.status).toBe(400);
  });

  it('/change-password renvoie 404 si l’utilisateur n’a pas de hash stocké', async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ passwordHash: null }));
    const res = await request(authApp()).put('/api/auth/change-password').send({ currentPassword: 'motdepasse123', newPassword: 'nouveaumotdepasse' });
    expect(res.status).toBe(404);
  });

  it('/change-password renvoie 500 si la base est en erreur', async () => {
    prismaMock.user.update.mockRejectedValueOnce(new Error('db down'));
    const res = await request(authApp()).put('/api/auth/change-password').send({ currentPassword: 'motdepasse123', newPassword: 'nouveaumotdepasse' });
    expect(res.status).toBe(500);
  });

  it('/first-login/acknowledge renvoie 500 si la base est en erreur', async () => {
    prismaMock.user.update.mockRejectedValueOnce(new Error('db down'));
    const res = await request(authApp()).post('/api/auth/first-login/acknowledge');
    expect(res.status).toBe(500);
  });
});