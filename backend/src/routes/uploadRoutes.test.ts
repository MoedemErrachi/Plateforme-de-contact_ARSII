import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, signToken } from '../test/helpers';
import { buildPrismaMock } from '../test/prismaMock';
import { buildSupabaseMock } from '../test/supabaseMock';
import uploadRouter from '../routes/uploadRoutes';

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../config/prisma', async () => ({ prisma: prismaMock }));

const supabaseMock = vi.hoisted(() => ({} as any));
vi.mock('../config/supabase', async () => {
  const { buildSupabaseMock } = await import('../test/supabaseMock');
  return { supabase: buildSupabaseMock(supabaseMock) };
});

// 8 premiers octets d'un PNG réel : 89 50 4E 47 0D 0A 1A 0A
function pngDataUrl(): string {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  return `data:image/png;base64,${header.toString('base64')}`;
}

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
    app.use('/api/uploads', uploadRouter);
  });
}

describe('Uploads - avatar', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
    delete supabaseMock.storage;
    buildSupabaseMock(supabaseMock);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', tokenVersion: 0, role: 'USER', privilege: 'READ_WRITE' });
  });

  it('refuse une image manquante (400)', async () => {
    const res = await request(appWithAuth()).post('/api/uploads/avatar').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_IMAGE');
  });

  it('refuse un format data URL invalide (400)', async () => {
    const res = await request(appWithAuth()).post('/api/uploads/avatar').send({ dataUrl: 'pas-une-data-url' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_IMAGE');
  });

  it('refuse un type MIME non autorisé (400)', async () => {
    const res = await request(appWithAuth()).post('/api/uploads/avatar').send({ dataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_MIME_TYPE');
  });

  it('refuse un contenu qui ne matche pas le type déclaré (400)', async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const res = await request(appWithAuth()).post('/api/uploads/avatar').send({ dataUrl: `data:image/png;base64,${jpeg.toString('base64')}` });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_IMAGE_CONTENT');
  });

  it('enregistre un avatar valide et renvoie l’URL publique (201)', async () => {
    const res = await request(appWithAuth()).post('/api/uploads/avatar').send({ dataUrl: pngDataUrl() });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.url).toBe('http://localhost/file');
  });

  it('renvoie 500 si Supabase rejette l’upload', async () => {
    supabaseMock.storage.from.mockReturnValueOnce({
      upload: vi.fn(async () => ({ data: null, error: new Error('boom') }))
    });
    const res = await request(appWithAuth()).post('/api/uploads/avatar').send({ dataUrl: pngDataUrl() });
    expect(res.status).toBe(500);
  });
});