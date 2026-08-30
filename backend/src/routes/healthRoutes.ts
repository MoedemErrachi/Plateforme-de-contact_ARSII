import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';

const router = Router();

const DB_CHECK_TIMEOUT_MS = 3000;

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Système]
 *     security: []
 *     summary: Sonde de santé
 *     description: Vérifie la joignabilité de la base de données (public, utilisé par les load balancers).
 *     responses:
 *       '200':
 *         description: Service sain, base connectée.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [healthy] }
 *                 database: { type: string, enum: [connected] }
 *                 uptime: { type: number }
 *                 timestamp: { type: string, format: date-time }
 *       '503':
 *         description: Base inaccessible.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [unhealthy] }
 *                 database: { type: string, enum: [disconnected] }
 *                 uptime: { type: number }
 *                 timestamp: { type: string, format: date-time }
 */

/**
 * GET /api/health — sonde de santé publique (load balancers, monitoring).
 * Vérifie la joignabilité de la base avec un timeout court ; ne lève jamais
 * vers le errorHandler : répond toujours du JSON structuré.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error('DB check timeout')), DB_CHECK_TIMEOUT_MS);
        timer.unref?.();
      })
    ]);
    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
