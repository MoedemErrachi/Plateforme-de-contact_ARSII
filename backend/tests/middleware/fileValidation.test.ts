import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../../src/config/prisma', async () => {
  const { buildPrismaMock } = await import('../test/prismaMock');
  buildPrismaMock(prismaMock);
  return { prisma: prismaMock };
});

import express from 'express';
import { validateFileUpload, sanitizeFilename, validateBulkImportPayload } from '../../src/middleware/fileValidation';

function appWith(handler: any) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.post('/upload', handler, (_req: any, res: any) => res.json({ ok: true, body: _req.body }));
  return app;
}

describe('sanitizeFilename', () => {
  it('supprime les chemins et caractères dangereux', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('..\\..\\wp-config.php')).toBe('wp-config.php');
    expect(sanitizeFilename('fichier sans accent é.csv')).toContain('_');
  });

  it('fournit des défauts raisonnables', () => {
    expect(sanitizeFilename('')).toBe('uploaded_file.csv');
  });
});

describe('validateFileUpload', () => {
  it('accepte un payload JSON avec rows', async () => {
    const res = await request(appWith(validateFileUpload)).post('/upload').send({ rows: [{ a: 1 }] });
    expect(res.status).toBe(200);
  });

  it('refuse sans fichier', async () => {
    const res = await request(appWith(validateFileUpload)).post('/upload').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FILE');
  });

  it('refuse un fichier trop volumineux', async () => {
    const res = await request(appWith(validateFileUpload)).post('/upload').send({ fileData: 'x', fileSize: 15 * 1024 * 1024 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
  });

  it('refuse un mime non autorisé', async () => {
    const res = await request(appWith(validateFileUpload)).post('/upload').send({ fileData: 'a', mimeType: 'application/x-msdownload' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_MIME_TYPE');
  });

  it('refuse une signature XLSX invalide', async () => {
    const res = await request(appWith(validateFileUpload)).post('/upload').send({
      fileName: 'book.xlsx',
      fileData: Buffer.from('plain text').toString('base64'),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FILE_SIGNATURE');
  });

  it('accepte un XLSX valide (signature ZIP)', async () => {
    const raw = String.fromCharCode(0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0);
    const res = await request(appWith(validateFileUpload)).post('/upload').send({
      fileName: '../book.xlsx',
      fileData: raw,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    expect(res.status).toBe(200);
    expect(res.body.body.fileName).toBe('book.xlsx');
  });

  it('refuse un CSV avec caractères binaires', async () => {
    const res = await request(appWith(validateFileUpload)).post('/upload').send({
      fileName: 'data.csv',
      fileData: 'nom,email\nAwa,\x00\x01invalide'
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FILE_SIGNATURE');
  });

  it('accepte un CSV texte valide', async () => {
    const res = await request(appWith(validateFileUpload)).post('/upload').send({
      fileName: 'data.csv',
      fileData: 'nom,email\nAwa,awa@mail.sn\n'
    });
    expect(res.status).toBe(200);
  });

  it('gère les erreurs internes de signature sans planter', async () => {
    const res = await request(appWith(validateFileUpload)).post('/upload').send({
      fileName: 'weird.csv',
      fileData: new Array(1000).fill('A').join(''),
      mimeType: 'text/csv'
    });
    expect([200, 400]).toContain(res.status);
  });

  it('absorbe une exception interne de contrôle de signature', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await request(appWith(validateFileUpload)).post('/upload').send({
      fileName: 'x.csv',
      fileData: 5,
      fileSize: 100,
      mimeType: 'text/csv'
    });
    expect(res.status).toBe(200);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('validateBulkImportPayload', () => {
  it('laisse passer les payloads contacts', async () => {
    const res = await request(appWith(validateBulkImportPayload)).post('/upload').send({ newContacts: [], updatedContacts: [] });
    expect(res.status).toBe(200);
  });

  it('retombe sur validateFileUpload sinon', async () => {
    const res = await request(appWith(validateBulkImportPayload)).post('/upload').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FILE');
  });
});