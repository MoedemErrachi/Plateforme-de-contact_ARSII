import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../config/prisma', async () => {
  const { buildPrismaMock } = await import('../test/prismaMock');
  buildPrismaMock(prismaMock);
  return { prisma: prismaMock };
});

import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { authenticateJWT, setAuthCookie, clearAuthCookie } from './authenticateJWT';
import { signToken } from '../test/helpers';

function appWithMiddleware() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/protected', authenticateJWT);
  app.get('/protected', (_req: any, res: any) => {
    res.json({ user: _req.user });
  });
  return app;
}

describe('authenticateJWT', () => {
  it('refuse l’accès sans jeton', async () => {
    const res = await request(appWithMiddleware()).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('refuse un jeton invalide', async () => {
    const res = await request(appWithMiddleware())
      .get('/protected')
      .set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('refuse si l’utilisateur n’existe plus en base', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    const token = signToken({ id: 'u1', email: 'a@b.c', name: 'A', role: 'user', tokenVersion: 99 });
    const res = await request(appWithMiddleware()).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_SESSION');
  });

  it('refuse si la version du jeton diverge', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: 'u1', tokenVersion: 99, role: 'user', privilege: null });
    const token = signToken({ id: 'u1', email: 'a@b.c', name: 'A', role: 'user', tokenVersion: 0 });
    const res = await request(appWithMiddleware()).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_VERSION_MISMATCH');
  });

  it('authentifie un jeton valide et relit le rôle en base', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: 'u1', tokenVersion: 0, role: 'ADMIN', privilege: 'FULL_ACCESS' });
    const token = signToken({ id: 'u1', email: 'a@b.c', name: 'Awa', role: 'user', tokenVersion: 0 });
    const res = await request(appWithMiddleware()).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.privilege).toBe('FULL_ACCESS');
  });

  it('refuse un jeton sans tokenVersion', async () => {
    const token = jwt.sign({ id: 'u1', email: 'a@b.c', name: 'A', role: 'user' }, process.env.JWT_SECRET || 'test-secret');
    const res = await request(appWithMiddleware()).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_VERSION_MISSING');
  });

  it('renvoie 503 si la base est indisponible', async () => {
    prismaMock.user.findUnique.mockRejectedValueOnce(new Error('db down'));
    const token = signToken({ id: 'u1', email: 'a@b.c', name: 'A', role: 'user', tokenVersion: 0 });
    const res = await request(appWithMiddleware()).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(503);
  });

  it('accepte un jeton porté par cookie', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: 'u1', tokenVersion: 0, role: 'user', privilege: null });
    const token = signToken({ id: 'u1', email: 'a@b.c', name: 'A', role: 'user', tokenVersion: 0 });
    const res = await request(appWithMiddleware())
      .get('/protected')
      .set('Cookie', [`accessToken=${token}`]);
    expect(res.status).toBe(200);
  });

  it('stoppe le démarrage si JWT_SECRET est absent', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('JWT_SECRET', '');
    vi.resetModules();
    await import('./authenticateJWT');
    vi.resetModules();
    vi.unstubAllEnvs();
    expect(errorSpy).toHaveBeenCalledWith('[FATAL] JWT_SECRET environment variable is not set. Refusing to start with an insecure fallback.');
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('setAuthCookie / clearAuthCookie', () => {
  function cookieApp() {
    const app = express();
    const payload = { id: 'u1', email: 'a@b.c', name: 'A', role: 'user', tokenVersion: 1 };
    app.get('/cookie', (_req: any, res: any) => {
      const token = setAuthCookie(res, payload);
      res.json({ token });
    });
    app.get('/remember', (_req: any, res: any) => {
      setAuthCookie(res, payload, true);
      res.json({ ok: true });
    });
    app.get('/clear', (_req: any, res: any) => {
      clearAuthCookie(res);
      res.json({ ok: true });
    });
    return app;
  }

  it('pose un cookie HttpOnly et renvoie le jeton', async () => {
    const res = await request(cookieApp()).get('/cookie');
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    const setCookie = res.headers['set-cookie'][0];
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Max-Age=28800');
  });

  it('pose un cookie de 7 jours avec rememberMe', async () => {
    const res = await request(cookieApp()).get('/remember');
    const setCookie = res.headers['set-cookie'][0];
    expect(setCookie).toContain('Max-Age=604800');
  });

  it('supprime le cookie à la déconnexion', async () => {
    const res = await request(cookieApp()).get('/clear');
    const setCookie = res.headers['set-cookie'][0];
    expect(setCookie).toContain('accessToken=;');
  });
});