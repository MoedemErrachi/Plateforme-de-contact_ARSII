import { Router, Request, Response, NextFunction } from 'express';
import { LogService } from '../services/logService';
import { prisma } from '../db/prisma';
import { LogType } from '@prisma/client';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/authenticateJWT';

const router = Router();
const logService = new LogService();

// POST /api/export/log
router.post('/log', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { format, fileName, recordCount } = req.body;
    const normalizedFormat = String(format || 'CSV').toUpperCase() as 'CSV' | 'XLSX' | 'PDF' | 'JSON';
    const log = await logService.createLog({
      type: 'EXPORT',
      format: normalizedFormat,
      fileName: fileName || `export_contacts_${Date.now()}.${normalizedFormat.toLowerCase()}`,
      recordCount: Number(recordCount) || 0,
      performedBy: req.user?.name,
      userId: req.user?.id
    });
    res.status(200).json({ status: 'success', data: { log } });
  } catch (error) {
    next(error);
  }
});

// GET /api/export/log?period=month|week|day (outil get_import_audit du chatbot)
router.get('/log', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = ['month', 'week', 'day'].includes(String(req.query.period)) ? String(req.query.period) : 'month';
    const now = new Date();
    const start = new Date(now);
    if (period === 'week') {
      start.setDate(now.getDate() - 7);
    } else if (period === 'day') {
      start.setDate(now.getDate() - 1);
    } else {
      start.setMonth(now.getMonth() - 1);
    }

    const logs = await prisma.importExportLog.findMany({
      where: { type: LogType.IMPORT, createdAt: { gte: start } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, fileName: true, recordCount: true, status: true, performedBy: true }
    });

    res.status(200).json({
      status: 'success',
      data: {
        count: logs.length,
        records: logs.map(log => ({
          date: log.createdAt.toISOString().slice(0, 10),
          fileName: log.fileName,
          recordCount: log.recordCount,
          status: log.status
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/export/logs
router.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await logService.getLogs('EXPORT');
    res.status(200).json({ status: 'success', data: { logs } });
  } catch (error) {
    next(error);
  }
});

// GET /api/export/data
router.get('/data', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contacts = await prisma.contact.findMany({
      include: {
        tags: { include: { tag: true } }
      }
    });
    res.status(200).json({ status: 'success', data: { contacts } });
  } catch (error) {
    next(error);
  }
});

export default router;
