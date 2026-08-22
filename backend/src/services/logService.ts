import { prisma } from '../config/prisma';
import { LogType, LogFormat } from '@prisma/client';

export class LogService {
  public async getLogs(type?: 'IMPORT' | 'EXPORT') {
    const where = type ? { type: type === 'IMPORT' ? LogType.IMPORT : LogType.EXPORT } : {};
    return await prisma.importExportLog.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  public async createLog(data: {
    type: 'IMPORT' | 'EXPORT';
    format: 'CSV' | 'XLSX' | 'JSON';
    fileName: string;
    recordCount: number;
    status?: string;
    errorMessage?: string;
    performedBy?: string;
    userId?: string;
  }) {
    const logType = data.type === 'IMPORT' ? LogType.IMPORT : LogType.EXPORT;
    const logFormat =
      data.format === 'CSV' ? LogFormat.CSV
      : data.format === 'XLSX' ? LogFormat.XLSX
      : LogFormat.JSON;

    return await prisma.importExportLog.create({
      data: {
        type: logType,
        format: logFormat,
        fileName: data.fileName,
        recordCount: data.recordCount,
        status: data.status || 'SUCCESS',
        errorMessage: data.errorMessage || null,
        performedBy: data.performedBy || 'Utilisateur Système',
        userId: data.userId || null
      }
    });
  }
}
