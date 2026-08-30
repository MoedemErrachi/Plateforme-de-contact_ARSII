import { Router, Request, Response, NextFunction } from 'express';
import { LogService } from '../services/logService';
import { prisma } from '../config/prisma';
import { LogType } from '@prisma/client';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/authenticateJWT';

const router = Router();
const logService = new LogService();

/**
 * @openapi
 * /api/export/log:
 *   post:
 *     tags: [Export & Logs]
 *     summary: Journalise un export
 *     description: Enregistre la réalisation d'un export (CSV/XLSX/JSON) dans l'historique des exports de l'utilisateur.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               format: { type: string, enum: [CSV, XLSX, JSON], default: CSV }
 *               fileName: { type: string, example: contacts_senegal_2026-08-29.csv }
 *               recordCount: { type: integer, example: 128 }
 *     responses:
 *       '200':
 *         description: Log créé.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     log:
 *                       type: object
 *                       properties:
 *                         id: { type: string, format: uuid }
 *                         type: { type: string, enum: [EXPORT] }
 *                         format: { type: string, enum: [CSV, XLSX, JSON] }
 *                         fileName: { type: string }
 *                         recordCount: { type: integer }
 *                         performedBy: { type: string, nullable: true }
 *   get:
 *     tags: [Export & Logs]
 *     summary: Historique des imports (audit)
 *     description: Liste les imports récents (utilisé par l'outil `get_import_audit` du chatbot). Filtré sur `type=IMPORT`.
 *     parameters:
 *       - name: period
 *         in: query
 *         schema: { type: string, enum: [day, week, month], default: month }
 *         description: Période de consultation.
 *     responses:
 *       '200':
 *         description: Récapitulatif des imports.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     count: { type: integer }
 *                     records:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date: { type: string, format: date, example: '2026-08-29' }
 *                           fileName: { type: string }
 *                           recordCount: { type: integer }
 *                           status: { type: string }
 */
router.post('/log', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { format, fileName, recordCount } = req.body;
    const normalizedFormat = String(format || 'CSV').toUpperCase() as 'CSV' | 'XLSX' | 'JSON';
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

export default router;
