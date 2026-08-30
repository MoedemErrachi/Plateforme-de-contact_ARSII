import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/appError';
import { validate } from '../middleware/validate';
import { AuthenticatedRequest } from '../middleware/authenticateJWT';

const router = Router();

const savedSearchSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Le nom est requis.').max(100, 'Le nom ne peut dépasser 100 caractères.'),
    filters: z.record(z.string(), z.any())
  })
});

/**
 * @openapi
 * /api/searches:
 *   get:
 *     tags: [Recherches]
 *     summary: Liste les recherches sauvegardées de l'utilisateur
 *     description: Strictement privées par utilisateur (filtre via le JWT).
 *     responses:
 *       '200':
 *         description: Recherches sauvegardées.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     searches:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/SavedSearch' }
 *   post:
 *     tags: [Recherches]
 *     summary: Sauvegarde une recherche
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, filters]
 *             properties:
 *               name: { type: string, maxLength: 100, example: Recherche doctorants Sénégal }
 *               filters:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Critères de filtrage (mêmes que `GET /api/contacts`).
 *     responses:
 *       '201':
 *         description: Recherche sauvegardée.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     search: { $ref: '#/components/schemas/SavedSearch' }
 * /api/searches/{id}:
 *   delete:
 *     tags: [Recherches]
 *     summary: Supprime une recherche sauvegardée
 *     description: Le propriétaire uniquement (404 si la recherche n'existe pas ou appartient à un autre utilisateur).
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Recherche supprimée.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     success: { type: boolean, example: true }
 *       '404':
 *         description: Recherche introuvable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Authentification requise.', 401);
    const searches = await prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ status: 'success', data: { searches } });
  } catch (error) {
    next(error);
  }
});

router.post('/', validate(savedSearchSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Authentification requise.', 401);
    const { name, filters } = req.body;
    const search = await prisma.savedSearch.create({
      data: { name, filters, userId }
    });
    res.status(201).json({ status: 'success', data: { search } });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Authentification requise.', 401);
    const existing = await prisma.savedSearch.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== userId) {
      throw new AppError('Recherche introuvable.', 404);
    }
    await prisma.savedSearch.delete({ where: { id: req.params.id } });
    res.status(200).json({ status: 'success', data: { success: true } });
  } catch (error) {
    next(error);
  }
});

export default router;
