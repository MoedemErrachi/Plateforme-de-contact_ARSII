import { describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../config/prisma', async () => {
  const { buildPrismaMock } = await import('../test/prismaMock');
  buildPrismaMock(prismaMock);
  return { prisma: prismaMock };
});

import { SegmentService, buildSegmentWhere } from './segmentService';

const service = new SegmentService();

describe('buildSegmentWhere', () => {
  it('retourne une clause vide sans filtres', () => {
    expect(buildSegmentWhere(undefined)).toEqual({});
    expect(buildSegmentWhere('nope')).toEqual({});
  });

  it('traduit pays, genres, stades et tags', () => {
    const where = buildSegmentWhere({
      countries: ['Sénégal', 'Mali'],
      genders: ['FEMALE'],
      careerStages: ['R1_FIRST_STAGE'],
      tags: ['Mobilité']
    });
    expect(where.countryOfOrigin).toEqual({ in: ['Sénégal', 'Mali'] });
    expect(where.gender).toEqual({ in: ['FEMALE'] });
    expect(where.researchCareerStage).toEqual({ in: ['R1_FIRST_STAGE'] });
    expect(where.tags).toEqual({ some: { tag: { name: { in: ['Mobilité'] } } } });
  });

  it('ignore les valeurs non-strings des filtres', () => {
    const where = buildSegmentWhere({ genders: ['FEMALE', '', 5], countries: null });
    expect(where.countryOfOrigin).toBeUndefined();
    expect(where.gender).toEqual({ in: ['FEMALE'] });
  });
});

describe('SegmentService', () => {
  it('liste les segments avec leur nombre de membres', async () => {
    prismaMock.segment.findMany.mockResolvedValueOnce([
      { id: 's1', name: 'Doctorants', filters: { countries: ['Sénégal'] } }
    ]);
    prismaMock.tag.findMany.mockResolvedValueOnce([{ id: 't1', name: 'Mobilité' }]);
    prismaMock.contact.count.mockResolvedValueOnce(9);

    const result = await service.getSegments();
    expect(result.segments[0].memberCount).toBe(9);
    expect(result.tags).toHaveLength(1);
    expect(prismaMock.contact.count).toHaveBeenCalledTimes(1);
  });

  it('associe des contacts à un tag dans une transaction', async () => {
    prismaMock.tag.findUnique.mockResolvedValueOnce({ id: 't1', name: 'Mobilité' });
    prismaMock.$transaction.mockImplementationOnce(async (cb: any) => cb(prismaMock));
    prismaMock.contact.findMany.mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }]);
    prismaMock.tagOnContact.deleteMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.tagOnContact.createMany.mockResolvedValueOnce({ count: 2 });
    prismaMock.tag.findUniqueOrThrow.mockResolvedValueOnce({ id: 't1', contacts: [], _count: { contacts: 2 } });

    const tag = await service.setTagContacts('t1', ['c1', 'c2', 'c1']);
    expect(tag.id).toBe('t1');
    expect(prismaMock.tagOnContact.createMany.mock.calls[0][0].data).toHaveLength(2);
  });

  it('lève une erreur 404 si le tag n’existe pas', async () => {
    prismaMock.tag.findUnique.mockResolvedValueOnce(null);
    await expect(service.setTagContacts('t1', ['c1'])).rejects.toMatchObject({ statusCode: 404 });
  });

  it('crée un segment', async () => {
    prismaMock.segment.create.mockResolvedValueOnce({ id: 's1', name: 'Doctorants' });
    const segment = await service.createSegment({ name: 'Doctorants', filters: { genders: ['FEMALE'] } });
    expect(segment.id).toBe('s1');
  });

  it('rejette un segment sans nom', async () => {
    await expect(service.createSegment({ name: '', filters: {} })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('met à jour un segment existant', async () => {
    prismaMock.segment.findUnique.mockResolvedValueOnce({ id: 's1' });
    prismaMock.segment.update.mockResolvedValueOnce({ id: 's1', name: 'Doctorants Sénégal' });
    const updated = await service.updateSegment('s1', { name: 'Doctorants Sénégal' });
    expect(updated.name).toBe('Doctorants Sénégal');
  });

  it('lève une erreur 404 sur un segment inconnu', async () => {
    prismaMock.segment.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateSegment('s1', { name: 'X' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('supprime un segment', async () => {
    prismaMock.segment.findUnique.mockResolvedValueOnce({ id: 's1' });
    prismaMock.segment.delete.mockResolvedValueOnce({ id: 's1' });
    await expect(service.deleteSegment('s1')).resolves.toEqual({ success: true });
  });

  it('lève une erreur 404 à la suppression d’un segment inconnu', async () => {
    prismaMock.segment.findUnique.mockResolvedValueOnce(null);
    await expect(service.deleteSegment('s1')).rejects.toMatchObject({ statusCode: 404 });
  });
});