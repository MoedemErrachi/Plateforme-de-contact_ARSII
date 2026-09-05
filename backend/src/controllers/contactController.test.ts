import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../test/helpers';

const svc = vi.hoisted(() => {
  class MockContactService {
    static last: any = null;
    constructor() {
      MockContactService.last = this;
    }
    getContacts = vi.fn(async () => ({ contacts: [], pagination: {} }));
    countExport = vi.fn(async () => 0);
    resolveExportColumns = vi.fn(async () => ({ keys: [], headers: [] }));
    collectExportRows = vi.fn(async () => []);
    buildXlsxBuffer = vi.fn(async () => Buffer.from('x'));
    streamExport = (async function* () {})();
    exportCsvCells = vi.fn(() => []);
    getContactById = vi.fn(async () => ({}));
    getDistinctCountries = vi.fn(async () => []);
    countByEmailPattern = vi.fn(async () => 3);
    createContact = vi.fn(async () => ({}));
    updateContact = vi.fn(async () => ({}));
    deleteContact = vi.fn(async () => ({}));
    bulkDelete = vi.fn(async () => ({ deletedCount: 2 }));
    bulkSave = vi.fn(async () => ({ createdCount: 1, updatedCount: 1, errors: [] }));
    importContactsPreview = vi.fn(async () => ({ rows: [] }));
    tagNames = vi.fn(() => []);
  }
  return { MockContactService };
});
vi.mock('../services/contactService', () => ({ ContactService: svc.MockContactService }));

const logSvc = vi.hoisted(() => {
  class MockLogService {
    static last: any = null;
    constructor() {
      MockLogService.last = this;
    }
    createLog = vi.fn(async () => ({}));
  }
  return { MockLogService };
});
vi.mock('../services/logService', () => ({ LogService: logSvc.MockLogService }));

import {
  getContacts,
  exportContacts,
  getDistinctCountries,
  countContactsByEmailPattern,
  createContact,
  updateContact,
  deleteContact,
  bulkDeleteContacts,
  bulkSaveContacts,
  importContacts
} from './contactController';

function get(app: any, path: string) {
  return request(app).get(path);
}

describe('contactController — chemins d’erreur', () => {
  it.each([
    ['getContacts', getContacts, 'getContacts'],
    ['exportContacts', exportContacts, 'countExport'],
    ['getDistinctCountries', getDistinctCountries, 'getDistinctCountries'],
    ['countContactsByEmailPattern', countContactsByEmailPattern, 'countByEmailPattern'],
    ['createContact', createContact, 'createContact'],
    ['updateContact', updateContact, 'updateContact'],
    ['deleteContact', deleteContact, 'deleteContact']
  ] as const)('%s délègue la panne du service à next', async (_label, handler, svcMethod) => {
    svc.MockContactService.last[svcMethod].mockRejectedValueOnce(new Error('db down'));
    const method = _label === 'createContact' ? 'post' : _label === 'updateContact' ? 'put' : _label === 'deleteContact' ? 'delete' : 'get';
    const path = _label === 'countContactsByEmailPattern' ? '/x?email_pattern=awa' : '/x';
    const app = buildTestApp((a) => a[method]('/x', handler));
    let req = request(app)[method](path);
    if (method === 'post' || method === 'put') req = req.send({});
    const res = await req;
    expect(res.status).toBe(500);
  });

  it('countContactsByEmailPattern compte sans pattern (400)', async () => {
    const res = await get(buildTestApp((a) => a.get('/x', countContactsByEmailPattern)), '/x');
    expect(res.status).toBe(400);
  });
});

describe('contactController — bulk', () => {
  it('bulkDelete refuse un ids non-tableau (400)', async () => {
    const res = await request(buildTestApp((a) => a.post('/x', bulkDeleteContacts))).post('/x').send({ ids: 'c1' });
    expect(res.status).toBe(400);
  });

  it('bulkDelete refuse une liste vide d’identifiants (400)', async () => {
    const res = await request(buildTestApp((a) => a.post('/x', bulkDeleteContacts))).post('/x').send({ ids: ['  ', 5] });
    expect(res.status).toBe(400);
  });

  it('bulkDelete supprime et répond (200)', async () => {
    const res = await request(buildTestApp((a) => a.post('/x', bulkDeleteContacts))).post('/x').send({ ids: ['c1', 'c2'] });
    expect(res.status).toBe(200);
    expect(res.body.data.deletedCount).toBe(2);
  });

  it('bulkDelete délègue la panne du service à next', async () => {
    svc.MockContactService.last.bulkDelete.mockRejectedValueOnce(new Error('db down'));
    const res = await request(buildTestApp((a) => a.post('/x', bulkDeleteContacts))).post('/x').send({ ids: ['c1'] });
    expect(res.status).toBe(500);
  });

  it('importContacts délègue la panne du service à next', async () => {
    svc.MockContactService.last.importContactsPreview.mockRejectedValueOnce(new Error('db down'));
    const res = await request(buildTestApp((a) => a.post('/x', importContacts))).post('/x').send({ rows: [] });
    expect(res.status).toBe(500);
  });

  it('bulkSave journalise l’échec de l’audit sans affecter l’import', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSvc.MockLogService.last.createLog.mockRejectedValueOnce(new Error('audit down'));
    const res = await request(buildTestApp((a) => a.post('/x', bulkSaveContacts))).post('/x').send({ newContacts: [{}] });
    expect(res.status).toBe(200);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it.each([
    ['P2002', Object.assign(new Error('dup'), { code: 'P2002', meta: { target: ['email'] } }), 'Contrainte d'],
    ['P2003', Object.assign(new Error('fk'), { code: 'P2003' }), 'Référence introuvable'],
    ['P2025', Object.assign(new Error('nf'), { code: 'P2025' }), 'Enregistrement introuvable'],
    ['générique', new Error('Ligne 7 : email invalide'), 'Ligne 7']
  ] as const)('bulkSave formate l’erreur %s en 500 propre', async (_label, error, marker) => {
    svc.MockContactService.last.bulkSave.mockRejectedValueOnce(error);
    const res = await request(buildTestApp((a) => a.post('/x', bulkSaveContacts))).post('/x').send({ newContacts: [{}] });
    expect(res.status).toBe(500);
    expect(res.body.status).toBe('FAILED');
    expect(res.body.errorMessage).toContain(marker);
  });

  it('bulkSave tronque les messages d’erreur très longs', async () => {
    const long = new Error('a'.repeat(500));
    svc.MockContactService.last.bulkSave.mockRejectedValueOnce(long);
    const res = await request(buildTestApp((a) => a.post('/x', bulkSaveContacts))).post('/x').send({});
    expect(res.status).toBe(500);
    expect(res.body.errorMessage.length).toBeLessThanOrEqual(301);
  });
});