import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/prisma', async () => {
  const { buildPrismaMock } = await import('../test/prismaMock');
  const prismaMock = {} as any;
  buildPrismaMock(prismaMock);
  return { prisma: prismaMock };
});

import {
  issueCsrfToken,
  isValidSignedCsrfToken,
  csrfProtection,
  sanitizeInput,
  authRateLimiter,
  globalApiRateLimiter,
  importRateLimiter,
  helmetMiddleware
} from './security';
import express from 'express';
import request from 'supertest';

describe('CSRF', () => {
  it('émet et valide un jeton signé', () => {
    const token = issueCsrfToken();
    expect(token).toContain('.');
    expect(isValidSignedCsrfToken(token)).toBe(true);
  });

  it('rejette un jeton non signé', () => {
    expect(isValidSignedCsrfToken('abc')).toBe(false);
    expect(isValidSignedCsrfToken('.abc')).toBe(false);
    expect(isValidSignedCsrfToken('abc.')).toBe(false);
    expect(isValidSignedCsrfToken(42)).toBe(false);
    expect(isValidSignedCsrfToken('abc.zz')).toBe(false);
  });

  it('pose un cookie XSRF-TOKEN et res.locals.csrfToken', async () => {
    const app = express();
    app.use(express.json());
    app.use(csrfProtection);
    app.get('/', (_req, res) => {
      res.json({ token: res.locals.csrfToken });
    });
    const res = await request(app).get('/');
    expect(res.body.token).toContain('.');
    expect(res.headers['set-cookie'][0]).toContain('XSRF-TOKEN=');
  });

  it('passe en mode développement (pas de contrôle CSRF)', async () => {
    const app = express();
    app.use(express.json());
    app.use(csrfProtection);
    app.post('/', (_req, res) => res.json({ ok: true }));
    const res = await request(app).post('/').send({ a: 1 });
    expect(res.status).toBe(200);
  });

  it('en production exige un header CSRF valide pour POST', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.CSRF_SECRET = 'secret-test';
    try {
      const validToken = issueCsrfToken();
      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.cookies = req.cookies || { 'XSRF-TOKEN': validToken };
        next();
      });
      app.use(csrfProtection);
      app.post('/some', (_req, res) => res.json({ ok: true }));

      const bad = await request(app).post('/some').send({});
      expect(bad.status).toBe(403);
      expect(bad.body.code).toBe('CSRF_VALIDATION_FAILED');

      const good = await request(app).post('/some').send({}).set('X-CSRF-Token', validToken);
      expect(good.status).toBe(200);
    } finally {
      process.env.NODE_ENV = originalEnv;
      delete process.env.CSRF_SECRET;
    }
  });

  it('en production renvoie 503 sans CSRF_SECRET', async () => {
    const originalEnv = process.env.NODE_ENV;
    delete process.env.CSRF_SECRET;
    process.env.NODE_ENV = 'production';
    try {
      const app = express();
      app.use(express.json());
      app.use(csrfProtection);
      app.post('/x', (_req, res) => res.json({ ok: true }));
      const res = await request(app).post('/x').send({});
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('CSRF_NOT_CONFIGURED');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

describe('sanitizeInput', () => {
  it('supprime les balises script et handlers dans body/query', async () => {
    const app = express();
    app.use(express.json());
    app.use(sanitizeInput);
    app.post('/', (req: any, res: any) => {
      res.json({ body: req.body, query: req.query });
    });
    const res = await request(app)
      .post('/?q=<script>x</script>onnée&x=javascript:alert(1)')
      .send({ name: 'Awa<script>alert(1)</script>', avatar: 'onclick="x()"' });
    expect(res.body.body.name).toBe('Awa');
    expect(res.body.body.avatar).toBe('');
    expect(res.body.query.q).toBe('onnée');
    expect(res.body.query.x).toBe('alert(1)');
  });

  it('laisse passer les valeurs non string', async () => {
    const app = express();
    app.use(express.json());
    app.use(sanitizeInput);
    app.post('/', (req: any, res: any) => res.json(req.body));
    const res = await request(app).post('/').send({ n: 5, list: ['<script>a</script>'], deep: { ok: true } });
    expect(res.body.n).toBe(5);
    expect(res.body.list[0]).toBe('');
    expect(res.body.deep.ok).toBe(true);
  });
});

describe('rate limiters', () => {
  it('exporte les limiters et helmet', () => {
    expect(typeof authRateLimiter).toBe('function');
    expect(typeof globalApiRateLimiter).toBe('function');
    expect(typeof importRateLimiter).toBe('function');
    expect(typeof helmetMiddleware).toBe('function');
  });

  it('bloque après max requêtes', async () => {
    const rateLimit = (await import('express-rate-limit')).default;
    const miniLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 3,
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false }
    });
    const app = express();
    app.use(miniLimiter);
    app.get('/', (_req: any, res: any) => res.json({ ok: true }));
    for (let i = 0; i < 3; i++) {
      const ok = await request(app).get('/');
      expect(ok.status).toBe(200);
    }
    const blocked = await request(app).get('/');
    expect(blocked.status).toBe(429);
  });
});