import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController';

const router = Router();

/**
 * @openapi
 * /api/dashboard/stats:
 *   get:
 *     tags: [Stats & Dashboard]
 *     summary: Indicateurs du tableau de bord
 *     description: KPI globaux, répartitions (genre, pays, stade de carrière) et activité récente.
 *     responses:
 *       '200':
 *         description: Statistiques agrégées.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   $ref: '#/components/schemas/DashboardStats'
 */

router.get('/stats', getDashboardStats);

export default router;
