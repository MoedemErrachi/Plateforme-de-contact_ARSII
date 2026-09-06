import { describe, expect, it, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({} as any));
vi.mock('../../src/config/prisma', async () => {
  const { buildPrismaMock } = await import('../test/prismaMock');
  buildPrismaMock(prismaMock);
  return { prisma: prismaMock };
});

import { LogService } from '../../src/services/logService';

const service = new LogService();

describe('LogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('liste les logs sans filtre', async () => {
    prismaMock.importExportLog.findMany.mockResolvedValueOnce([{ id: 'l1', type: 'IMPORT' }]);
    const logs = await service.getLogs();
    expect(logs).toHaveLength(1);
    expect(prismaMock.importExportLog.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' }
    });
  });

  it('liste les logs d’import uniquement', async () => {
    prismaMock.importExportLog.findMany.mockResolvedValueOnce([]);
    await service.getLogs('IMPORT');
    expect(prismaMock.importExportLog.findMany.mock.calls[0][0].where.type).toBe('IMPORT');
  });

  it('liste les logs d’export uniquement', async () => {
    prismaMock.importExportLog.findMany.mockResolvedValueOnce([]);
    await service.getLogs('EXPORT');
    expect(prismaMock.importExportLog.findMany.mock.calls[0][0].where.type).toBe('EXPORT');
  });

  it('crée un log CSV importé avec les valeurs fournies', async () => {
    prismaMock.importExportLog.create.mockResolvedValueOnce({ id: 'l2' });
    await service.createLog({
      type: 'IMPORT',
      format: 'CSV',
      fileName: 'contacts.csv',
      recordCount: 42,
      status: 'SUCCESS',
      performedBy: 'Awa Diop',
      userId: 'u1'
    });
    const data = prismaMock.importExportLog.create.mock.calls[0][0].data;
    expect(data.type).toBe('IMPORT');
    expect(data.format).toBe('CSV');
    expect(data.recordCount).toBe(42);
    expect(data.performedBy).toBe('Awa Diop');
  });

  it('crée un log XLSX exporté avec les valeurs par défaut', async () => {
    prismaMock.importExportLog.create.mockResolvedValueOnce({ id: 'l3' });
    await service.createLog({
      type: 'EXPORT',
      format: 'XLSX',
      fileName: 'export.xlsx',
      recordCount: 7
    });
    const data = prismaMock.importExportLog.create.mock.calls[0][0].data;
    expect(data.type).toBe('EXPORT');
    expect(data.format).toBe('XLSX');
    expect(data.status).toBe('SUCCESS');
    expect(data.performedBy).toBe('Utilisateur Système');
    expect(data.userId).toBeNull();
  });

  it('mappe JSON et enregistre un statut personnalisé', async () => {
    prismaMock.importExportLog.create.mockResolvedValueOnce({ id: 'l4' });
    await service.createLog({
      type: 'EXPORT',
      format: 'JSON',
      fileName: 'export.json',
      recordCount: 1,
      status: 'PARTIAL',
      errorMessage: 'quelques erreurs'
    });
    const data = prismaMock.importExportLog.create.mock.calls[0][0].data;
    expect(data.format).toBe('JSON');
    expect(data.status).toBe('PARTIAL');
    expect(data.errorMessage).toBe('quelques erreurs');
  });
});