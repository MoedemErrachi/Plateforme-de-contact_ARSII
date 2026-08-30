import { Router } from 'express';
import { getStatsAggregation } from '../controllers/statsController';
import { validate } from '../middleware/validate';
import { aggregationQuerySchema } from '../validators/contactValidator';

const router = Router();

/**
 * @openapi
 * /api/stats/aggregation:
 *   get:
 *     tags: [Stats & Dashboard]
 *     summary: Agrége le nombre de contacts par groupe
 *     description: Retourne directement la map `valeur -> count`. Filtres identiques à `GET /api/contacts`.
 *     parameters:
 *       - name: group_by
 *         in: query
 *         required: true
 *         schema: { type: string, enum: [gender, countryOfOrigin, facultyDepartment, researchCareerStage] }
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *       - name: countryOfOrigin
 *         in: query
 *         schema: { type: string }
 *       - name: gender
 *         in: query
 *         schema: { $ref: '#/components/schemas/Gender' }
 *       - name: careerStage
 *         in: query
 *         schema: { $ref: '#/components/schemas/CareerStage' }
 *       - name: researchCareerStage
 *         in: query
 *         schema: { $ref: '#/components/schemas/CareerStage' }
 *       - name: affiliation
 *         in: query
 *         schema: { type: string }
 *       - name: facultyDepartment
 *         in: query
 *         schema: { type: string }
 *       - name: tagId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: segmentId
 *         in: query
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Fréquences par groupe.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AggregationResponse'
 *       '400':
 *         description: Paramètre `group_by` manquant ou invalide.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// GET /api/stats/aggregation?group_by=gender|countryOfOrigin|facultyDepartment|researchCareerStage&<filters>
router.get('/aggregation', validate(aggregationQuerySchema), getStatsAggregation);

export default router;
