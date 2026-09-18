import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../../src/config/prisma', async () => {
  const { buildPrismaMock } = await import('../test/prismaMock');
  buildPrismaMock(prismaMock);
  return { prisma: prismaMock };
});

import express from 'express';
import { z } from 'zod';
import { validate } from '../../src/middleware/validate';

const schema = z.object({
  body: z.object({ name: z.string().min(2) }),
  params: z.object({ id: z.string().min(2) })
});

function appWith() {
  const app = express();
  app.use(express.json());
  app.post('/:id', validate(schema), (req: any, res: any) => res.json({ ok: true, body: req.body }));
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erreur interne' });
  });
  return app;
}

describe('validate middleware', () => {
  it('passe pour un corps valide', async () => {
    const res = await request(appWith()).post('/abc').send({ name: 'Awa' });
    expect(res.status).toBe(200);
    expect(res.body.body.name).toBe('Awa');
  });

  it('renvoie 400 avec message détaillé pour un corps invalide', async () => {
    const res = await request(appWith()).post('/abc').send({ name: 'A' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('body.name');
  });

  it('renvoie 400 si le param est invalide', async () => {
    const res = await request(appWith()).post('/a').send({ name: 'Awa' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('params.id');
  });

  it('transmet les erreurs non-Zod au handler d’erreur', async () => {
    const boom = z.object({
      body: z.custom(() => {
        throw new Error('boom custom');
      }, 'INVALID_VALUE')
    });
    const app = express();
    app.use(express.json());
    app.post('/', validate(boom as any), (_req: any, _res: any) => {});
    app.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: err.message }));
    const res = await request(app).post('/').send({});
    expect(res.status).toBe(500);
  });
});