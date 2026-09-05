import { describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../config/prisma', async () => {
  const { buildPrismaMock } = await import('../test/prismaMock');
  buildPrismaMock(prismaMock);
  return { prisma: prismaMock };
});

import { DashboardService } from './dashboardService';

const service = new DashboardService();

describe('DashboardService', () => {
  it('calcule les KPI et répartitions', async () => {
    prismaMock.contact.count.mockResolvedValueOnce(100);
    prismaMock.contact.groupBy.mockImplementationOnce(async () => [
      { countryOfOrigin: 'Sénégal', _count: { id: 60 } },
      { countryOfOrigin: null, _count: { id: 40 } }
    ]);
    prismaMock.contact.groupBy.mockImplementationOnce(async () => [
      { gender: 'FEMALE', _count: { id: 70 } }
    ]);
    prismaMock.contact.groupBy.mockImplementationOnce(async () => [
      { researchCareerStage: 'R4_LEADING', _count: { id: 25 } },
      { researchCareerStage: 'R3_ESTABLISHED', _count: { id: 15 } },
      { researchCareerStage: 'R1_FIRST_STAGE', _count: { id: 60 } }
    ]);
    prismaMock.tagOnContact.groupBy.mockResolvedValueOnce([
      { tagId: 't1', _count: { _all: 12 } }
    ]);
    prismaMock.contact.groupBy.mockImplementationOnce(async () => [
      { countryOfOrigin: 'Sénégal', gender: 'FEMALE', _count: { id: 60 } }
    ]);
    prismaMock.contact.groupBy.mockImplementationOnce(async () => [
      { affiliation: 'UCAD', _count: { id: 8 } },
      { affiliation: null, _count: { id: 2 } }
    ]);
    prismaMock.tag.findMany.mockResolvedValueOnce([
      { id: 't1', name: 'Mobilité', color: '#bada55' }
    ]);

    const stats = await service.getDashboardStats();
    expect(stats.kpis.totalContacts).toBe(100);
    expect(stats.kpis.countriesCovered).toBe(2);
    expect(stats.kpis.affiliationsCount).toBe(1);
    expect(stats.kpis.seniorResearchers.count).toBe(40);
    expect(stats.distributionByCountry[0].iso2).toBe('SN');
    expect(stats.distributionByTag[0]).toMatchObject({ tagId: 't1', name: 'Mobilité', count: 12 });
    expect(stats.countryLabels.length).toBeGreaterThan(190);
  });

  it('gère le cas d’une base vide', async () => {
    prismaMock.contact.count.mockResolvedValueOnce(0);
    prismaMock.contact.groupBy.mockImplementation(async () => []);
    prismaMock.tagOnContact.groupBy.mockResolvedValueOnce([]);
    prismaMock.tag.findMany.mockResolvedValueOnce([]);

    const stats = await service.getDashboardStats();
    expect(stats.kpis.totalContacts).toBe(0);
    expect(stats.kpis.seniorResearchers.percentage).toBe(0);
    expect(stats.distributionByCountry).toEqual([]);
    expect(stats.distributionByTag).toEqual([]);
  });
});