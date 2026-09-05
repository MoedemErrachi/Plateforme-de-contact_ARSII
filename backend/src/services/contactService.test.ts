import { describe, expect, it, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../config/prisma', async () => {
  const { buildPrismaMock } = await import('../test/prismaMock');
  buildPrismaMock(prismaMock);
  return { prisma: prismaMock };
});

import { ContactService, EXPORT_FIELD_KEYS } from './contactService';
import { buildPrismaMock } from '../test/prismaMock';

const service = new ContactService();

const SAMPLE_CONTACT = {
  id: 'c1',
  firstName: 'Awa',
  lastName: 'Diop',
  email: 'awa@mail.sn',
  gender: 'FEMALE',
  countryOfOrigin: 'Sénégal',
  city: 'Dakar',
  phone: null,
  affiliation: 'UCAD',
  function: null,
  experience: null,
  facultyDepartment: 'Sciences',
  researchCareerStage: 'R2_RECOGNIZED',
  avatarUrl: null,
  tags: [{ tag: { id: 't9', name: 'Mobilité', color: 'red', description: null } }]
};

describe('ContactService — listing & aggregation', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
  });

  it('liste les contacts paginés', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ n: 3n }])
      .mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }]);
    prismaMock.contact.findMany.mockResolvedValueOnce([SAMPLE_CONTACT, SAMPLE_CONTACT, SAMPLE_CONTACT]);

    const result = await service.getContacts({ page: 1, limit: 20, search: 'awa', countryOfOrigin: 'Sénégal' });
    expect(result.contacts).toHaveLength(3);
    expect(result.pagination.totalCount).toBe(3);
    expect(result.pagination.totalPages).toBe(1);
    expect(result.pagination.hasPrevPage).toBe(false);
  });

  it('liste les contacts sans résultat (pagination safe)', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ n: 0n }]).mockResolvedValueOnce([]);
    prismaMock.contact.findMany.mockResolvedValueOnce([]);
    const result = await service.getContacts({ page: 5, limit: 0 as any });
    expect(result.contacts).toHaveLength(0);
    expect(result.pagination.totalPages).toBe(1);
    expect(result.pagination.page).toBe(5);
    expect(result.pagination.limit).toBe(20);
  });

  it('compte les exports', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ n: 4n }]);
    await expect(service.countExport({ ids: ['c1'] })).resolves.toBe(4);
  });

  it('liste les pays distincts', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ country: 'Sénégal' }, { country: 'Mali' }]);
    await expect(service.getDistinctCountries()).resolves.toEqual(['Sénégal', 'Mali']);
  });

  it('agrège par genre', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { label: 'FEMALE', n: 5n },
      { label: '', n: 1n }
    ]);
    const agg = await service.getAggregation('gender', {});
    expect(agg).toEqual({ FEMALE: 5, 'Non renseigné': 1 });
  });

  it('rejette un group_by interdit', async () => {
    await expect(service.getAggregation('hacker', {})).rejects.toMatchObject({ statusCode: 400 });
  });

  it('compte les emails correspondant à un motif', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ n: 7n }]);
    await expect(service.countByEmailPattern('import_null_')).resolves.toBe(7);
  });

  it('récupère un contact par id', async () => {
    prismaMock.contact.findUnique.mockResolvedValueOnce(SAMPLE_CONTACT);
    await expect(service.getContactById('c1')).resolves.toMatchObject({ id: 'c1' });
  });

  it('lève 404 si le contact est introuvable', async () => {
    prismaMock.contact.findUnique.mockResolvedValueOnce(null);
    await expect(service.getContactById('zzz')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('ContactService — CRUD', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
  });

  it('crée un contact sans tag', async () => {
    prismaMock.contact.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...SAMPLE_CONTACT, tags: [] });
    prismaMock.contact.create.mockResolvedValueOnce({ id: 'c1' });

    const created = await service.createContact({ email: 'awa@mail.sn', fullName: 'Awa Diop', countryOfOrigin: 'SN' });
    expect(created?.email).toBe('awa@mail.sn');
    const createData = prismaMock.contact.create.mock.calls[0][0].data;
    expect(createData.countryOfOrigin).toBe('Sénégal');
    expect(createData.firstName).toBe('Awa');
  });

  it('lève 409 si l’email existe déjà', async () => {
    prismaMock.contact.findUnique.mockResolvedValueOnce({ id: 'c1', email: 'dup@mail.sn' });
    await expect(service.createContact({ email: 'dup@mail.sn' })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('associe des tags à la création', async () => {
    prismaMock.contact.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...SAMPLE_CONTACT, tags: [] });
    prismaMock.contact.create.mockResolvedValueOnce({ id: 'c1' });
    prismaMock.tag.findMany.mockResolvedValueOnce([{ id: 't1' }]);

    await service.createContact({ email: 'awa@mail.sn', tagIds: ['t1', 'missing'] });
    expect(prismaMock.tagOnContact.deleteMany).toHaveBeenCalled();
    expect(prismaMock.tagOnContact.createMany.mock.calls[0][0].data).toEqual([{ contactId: 'c1', tagId: 't1' }]);
  });

  it('met à jour un contact', async () => {
    prismaMock.contact.findUnique.mockResolvedValueOnce({ ...SAMPLE_CONTACT, email: 'old@mail.sn' });
    prismaMock.contact.update.mockResolvedValueOnce({ ...SAMPLE_CONTACT, firstName: 'Awa', researchCareerStage: 'R3_ESTABLISHED' });
    prismaMock.contact.findUnique.mockResolvedValueOnce({ ...SAMPLE_CONTACT });

    const updated = await service.updateContact('c1', {
      firstName: 'Awa',
      researchCareerStage: 'R3_ESTABLISHED'
    });
    const updateData = prismaMock.contact.update.mock.calls[0][0].data;
    expect(updateData.researchCareerStage).toBe('R3_ESTABLISHED');
    expect(updated).toBeDefined();
  });

  it('lève 409 si un autre contact possède le même email', async () => {
    prismaMock.contact.findUnique
      .mockResolvedValueOnce({ id: 'c1', email: 'old@mail.sn' })
      .mockResolvedValueOnce({ id: 'other', email: 'new@mail.sn' });
    await expect(service.updateContact('c1', { email: 'new@mail.sn' })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('supprime un contact', async () => {
    prismaMock.contact.findUnique.mockResolvedValueOnce({ id: 'c1' });
    prismaMock.contact.delete.mockResolvedValueOnce({ id: 'c1' });
    await expect(service.deleteContact('c1')).resolves.toEqual({ success: true, deletedId: 'c1' });
  });

  it('lève 404 à la suppression d’un contact inconnu', async () => {
    prismaMock.contact.findUnique.mockResolvedValueOnce(null);
    await expect(service.deleteContact('c1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('supprime en lot', async () => {
    prismaMock.contact.deleteMany.mockResolvedValueOnce({ count: 2 });
    await expect(service.bulkDelete(['c1', 'c2'])).resolves.toEqual({ success: true, deletedCount: 2 });
  });
});

describe('ContactService — bulkSave', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
  });

  it('crée les nouveaux contacts en masse', async () => {
    prismaMock.contact.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: 'c1', email: 'one@mail.sn' },
      { id: 'c2', email: 'two@mail.sn' }
    ]);
    prismaMock.contact.createMany.mockResolvedValueOnce({ count: 2 });

    const result = await service.bulkSave(
      [{ email: 'one@mail.sn', firstName: 'One' }, { email: 'two@mail.sn', firstName: 'Two' }],
      []
    );
    expect(result.createdCount).toBe(2);
    expect(result.updatedCount).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('replie sur un create ligne à ligne en cas d’échec du lot', async () => {
    prismaMock.contact.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: 'c1', email: 'one@mail.sn' }
    ]);
    prismaMock.contact.createMany.mockRejectedValueOnce(new Error('batch failed'));

    const result = await service.bulkSave(
      [{ email: 'one@mail.sn' }, { email: 'two@mail.sn' }],
      []
    );
    expect(result.createdCount).toBe(2);
    expect(prismaMock.contact.create).toHaveBeenCalledTimes(2);
    expect(result.errors).toEqual([]);
  });

  it('associe les tags aux nouveaux contacts déjà en base et retire les obsolètes', async () => {
    prismaMock.contact.findMany.mockResolvedValueOnce([{ id: 'c1', email: 'awa@mail.sn' }]);
    prismaMock.tag.findMany.mockResolvedValueOnce([{ id: 't1' }]);
    prismaMock.tagOnContact.findMany.mockResolvedValueOnce([
      { contactId: 'c1', tagId: 't1' },
      { contactId: 'c1', tagId: 't2' }
    ]);

    const result = await service.bulkSave(
      [{ email: 'awa@mail.sn', firstName: 'Awa', tagIds: ['t1', 't2'] }],
      []
    );
    expect(result.createdCount).toBe(0);
    expect(prismaMock.tagOnContact.createMany).not.toHaveBeenCalled();
    const deleteManyData = prismaMock.tagOnContact.deleteMany.mock.calls[0][0];
    expect(deleteManyData.where).toEqual({ contactId: 'c1', tagId: { in: ['t2'] } });
  });

  it('ajoute les tags manquants sur un nouveau contact déjà en base', async () => {
    prismaMock.contact.findMany.mockResolvedValueOnce([{ id: 'c1', email: 'awa@mail.sn' }]);
    prismaMock.tag.findMany.mockResolvedValueOnce([{ id: 't1' }]);
    prismaMock.tagOnContact.findMany.mockResolvedValueOnce([]);

    await service.bulkSave([{ email: 'awa@mail.sn', tagIds: ['t1'] }], []);
    const createManyData = prismaMock.tagOnContact.createMany.mock.calls[0][0].data;
    expect(createManyData).toEqual([{ contactId: 'c1', tagId: 't1' }]);
  });

  it('met à jour les contacts existants', async () => {
    prismaMock.contact.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'c1' }]);
    const result = await service.bulkSave(
      [],
      [{ id: 'c1', email: 'awa@mail.sn', firstName: 'Awa', tagIds: ['t1'] }]
    );
    expect(result.updatedCount).toBe(1);
    expect(prismaMock.contact.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c1' } }));
  });

  it('collecte les erreurs de mise à jour (contact introuvable)', async () => {
    prismaMock.contact.findMany.mockResolvedValueOnce([]);

    const result = await service.bulkSave([], [{ id: 'ghost', email: 'x@mail.sn' }]);
    expect(result.updatedCount).toBe(0);
    expect(result.errors[0].message).toContain('non trouvé');
  });

  it('déduplique les emails répétés dans le même lot', async () => {
    prismaMock.contact.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: 'c1', email: 'one@mail.sn' }
    ]);
    prismaMock.contact.createMany.mockResolvedValueOnce({ count: 1 });

    const result = await service.bulkSave(
      [{ email: 'one@mail.sn' }, { email: 'one@mail.sn' }],
      []
    );
    expect(result.createdCount).toBe(1);
    expect(prismaMock.contact.createMany.mock.calls[0][0].data).toHaveLength(1);
  });
});

describe('ContactService — import preview & export', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
  });

  it('prévisualise un import (valide, doublon, invalide)', async () => {
    prismaMock.contact.findMany.mockResolvedValueOnce([
      { id: 'c1', email: 'dup@mail.sn' }
    ]);
    const result = await service.importContactsPreview([
      { email: 'dup@mail.sn' },
      { email: 'new@mail.sn', firstName: 'Nouveau' },
      { fullName: '' }
    ]);
    expect(result.summary).toEqual({ totalInput: 3, validCount: 1, duplicateCount: 1, invalidCount: 1 });
    expect(result.preview[0].status).toBe('DUPLICATE');
    expect(result.preview[1].status).toBe('VALID');
    expect(result.preview[2].status).toBe('INVALID');
    expect(result.preview[2].message).toBe('Nom et email manquants');
  });

  it('résout les colonnes d’export', () => {
    const { keys, headers } = service.resolveExportColumns(undefined, true);
    expect(keys).toEqual(EXPORT_FIELD_KEYS);
    expect(headers[headers.length - 1]).toBe('Étiquettes / Tags');

    const partial = service.resolveExportColumns(['email', 'countryOfOrigin']);
    expect(partial.keys).toEqual(['email', 'countryOfOrigin']);
  });

  it('sérialise les cellules CSV', () => {
    expect(service.exportCsvCells(SAMPLE_CONTACT, ['gender', 'researchCareerStage'], true)).toEqual([
      '"Femme"',
      '"R2 — Chercheur reconnu (Recognised)"',
      '"Mobilité"'
    ]);
    expect(service.tagNames(SAMPLE_CONTACT)).toEqual(['Mobilité']);
  });

  it('réalise un export JSON (stream)', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }])
      .mockResolvedValueOnce([]);
    prismaMock.contact.findMany.mockResolvedValueOnce([SAMPLE_CONTACT, SAMPLE_CONTACT]);
    const rows = await service.collectExportRows({});
    expect(rows).toHaveLength(2);
  });

  it('construit un buffer XLSX', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: 'c1' }]).mockResolvedValueOnce([]);
    prismaMock.contact.findMany.mockResolvedValueOnce([SAMPLE_CONTACT]);
    const buffer = await service.buildXlsxBuffer({}, ['email', 'countryOfOrigin']);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
  });
});

describe('ContactService — branches de couverture', () => {
  beforeEach(() => {
    buildPrismaMock(prismaMock, true);
  });

  it('construit les conditions genre/étape/tag/segment', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ n: 0n }]).mockResolvedValueOnce([]);
    prismaMock.contact.findMany.mockResolvedValueOnce([]);
    const result = await service.getContacts({
      gender: 'FEMALE',
      researchCareerStage: 'R2_RECOGNIZED',
      careerStage: 'R3_ESTABLISHED',
      tagId: 't1',
      segmentId: 's2',
      affiliation: 'UCAD',
      facultyDepartment: 'Informatique'
    });
    expect(result.contacts).toHaveLength(0);
    expect(prismaMock.$queryRaw).toHaveBeenCalled();
  });

  it('parcourt plusieurs lots lors d’un export (cursor id)', async () => {
    const ids = Array.from({ length: 200 }, (_, i) => ({ id: `c${i}` }));
    prismaMock.$queryRaw
      .mockResolvedValueOnce(ids).mockResolvedValueOnce([]);
    prismaMock.contact.findMany.mockResolvedValueOnce(
      ids.map((r, i) => ({ ...SAMPLE_CONTACT, id: r.id, firstName: `N${i}` }))
    );
    const rows: any[] = [];
    for await (const c of service.streamExport({})) rows.push(c);
    expect(rows).toHaveLength(200);
  });

  it('crée un contact avec un email sans @ via un placeholder import_null_', async () => {
    prismaMock.contact.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...SAMPLE_CONTACT, tags: [] });
    prismaMock.contact.create.mockResolvedValueOnce({ id: 'c1' });
    const created = await service.createContact({ email: 'awa', fullName: 'Awa Diop' });
    expect(created).toBeDefined();
    const email = prismaMock.contact.create.mock.calls[0][0].data.email;
    expect(email).toMatch(/^import_null_[0-9a-f-]+@euraxess\.africa$/);
  });

  it('lève 404 à la mise à jour d’un contact inconnu', async () => {
    prismaMock.contact.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateContact('zzz', { firstName: 'A' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('met à jour un contact en remplaçant ses tags', async () => {
    prismaMock.contact.findUnique
      .mockResolvedValueOnce({ id: 'c1', email: 'awa@mail.sn' })
      .mockResolvedValueOnce({ ...SAMPLE_CONTACT, tags: [] });
    prismaMock.contact.update.mockResolvedValueOnce({ ...SAMPLE_CONTACT });
    prismaMock.tag.findMany.mockResolvedValueOnce([{ id: 't1' }]);
    const updated = await service.updateContact('c1', { firstName: 'Awa', tagIds: ['t1'] });
    expect(updated).toBeDefined();
    expect(prismaMock.tagOnContact.deleteMany).toHaveBeenCalled();
    expect(prismaMock.tagOnContact.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [{ contactId: 'c1', tagId: 't1' }] })
    );
  });

  it('formate les 4 familles d’erreurs lors du repli ligne à ligne', async () => {
    prismaMock.contact.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prismaMock.contact.createMany.mockRejectedValueOnce(new Error('batch failed'));
    prismaMock.contact.create
      .mockRejectedValueOnce(new Error('Prisma Unique constraint failed on email'))
      .mockRejectedValueOnce(new Error('Foreign key constraint failed'))
      .mockRejectedValueOnce(new Error('Prisma Invalid input'))
      .mockRejectedValueOnce(new Error('x'.repeat(200)));

    const result = await service.bulkSave(
      [{ email: 'a@mail.sn' }, { email: 'b@mail.sn' }, { email: 'c@mail.sn' }, { email: 'd@mail.sn' }],
      []
    );
    expect(result.errors).toHaveLength(4);
    expect(result.errors[0].message).toContain('e-mail déjà existant');
    expect(result.errors[1].message).toContain('référence introuvable');
    expect(result.errors[2].message).toContain('données invalides');
    expect(result.errors[3].message.length).toBeLessThan(400);
  });

  it('formate l’erreur lors de la collecte des mises à jour', async () => {
    prismaMock.contact.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'c1' }]);
    const result = await service.bulkSave([], [{ id: 'c1', tagIds: ['t1'] }]);
    expect(result.updatedCount).toBe(0);
    expect(result.errors[0].message).toContain('c1');
  });

  it('formate l’erreur lors de l’exécution des mises à jour par lots', async () => {
    prismaMock.contact.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'c1' }]);
    prismaMock.contact.update.mockRejectedValueOnce(new Error('Unique constraint'));
    const result = await service.bulkSave([], [{ id: 'c1', email: 'x@mail.sn', firstName: 'A' }]);
    expect(result.errors[0].message).toContain('e-mail déjà existant');
  });
});