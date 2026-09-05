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

  it.each([
    { name: 'manquante', dataUrl: undefined, code: 'MISSING_IMAGE' },
    { name: 'au format data URL invalide', dataUrl: 'pas-une-data-url', code: 'INVALID_IMAGE' },
    { name: 'au type MIME non autorisé', dataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', code: 'INVALID_MIME_TYPE' },
    { name: 'dont le contenu ne matche pas le type déclaré', dataUrl: `data:image/png;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString('base64')}`, code: 'INVALID_IMAGE_CONTENT' },
    { name: 'sans signature reconnue', dataUrl: `data:image/png;base64,${Buffer.from('abc').toString('base64')}`, code: 'INVALID_IMAGE_CONTENT' },
    { name: 'vide', dataUrl: 'data:image/png;base64, ', code: 'EMPTY_IMAGE' },
    { name: 'trop volumineuse', dataUrl: `data:image/png;base64,${Buffer.alloc(6 * 1024 * 1024, 0x41).toString('base64')}`, code: 'IMAGE_TOO_LARGE' }
  ])('refuse une image $name (400)', async ({ dataUrl, code }: { dataUrl?: string; code: string }) => {
    const res = await request(appWithAuth()).post('/api/uploads/avatar').send(dataUrl ? { dataUrl } : {});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(code);
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

  it('enregistre un avatar webp valide (201)', async () => {
    const header = Buffer.concat([Buffer.from('RIFFxxxxWEBP', 'ascii'), Buffer.alloc(64, 0)]);
    const res = await request(appWithAuth()).post('/api/uploads/avatar').send({ dataUrl: `data:image/webp;base64,${header.toString('base64')}` });
    expect(res.status).toBe(201);
    expect(res.body.url).toBe('http://localhost/file');
  });

  it('renvoie 500 si Supabase lève une exception (non rejetée)', async () => {
    supabaseMock.storage.from.mockReturnValueOnce({
      upload: vi.fn(() => {
        throw new Error('boom');
      })
    });
    const res = await request(appWithAuth()).post('/api/uploads/avatar').send({ dataUrl: pngDataUrl() });
    expect(res.status).toBe(500);
  });
});