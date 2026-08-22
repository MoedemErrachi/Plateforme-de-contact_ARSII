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
 * Requêtes de recherche sauvegardées — strictement privées par utilisateur.
 * GET    /api/searches        → liste des recherches de l'utilisateur
 * POST   /api/searches        → création ({ name, filters })
 * DELETE /api/searches/:id    → suppression (propriétaire uniquement)
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
