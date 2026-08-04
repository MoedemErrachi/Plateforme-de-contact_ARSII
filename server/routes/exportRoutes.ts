import { Router, Request, Response, NextFunction } from 'express';
import { LogService } from '../services/logService';
import { prisma } from '../db/prisma';

const router = Router();
const logService = new LogService();

// POST /api/export/log
router.post('/log', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { format, fileName, recordCount, performedBy } = req.body;
    const log = await logService.createLog({
      type: 'EXPORT',
      format: format || 'XLSX',
      fileName: fileName || 'export_contacts.xlsx',
      recordCount: recordCount || 0,
      performedBy: performedBy || 'Utilisateur Système'
    });
    res.status(200).json({ status: 'success', data: { log } });
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
        typeActeur: true,
        tags: { include: { tag: true } }
      }
    });
    res.status(200).json({ status: 'success', data: { contacts } });
  } catch (error) {
    next(error);
  }
});

export default router;
