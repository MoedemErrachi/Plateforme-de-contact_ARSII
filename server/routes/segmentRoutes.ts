import { Router, Request, Response, NextFunction } from 'express';
import { getSegments, createSegment, updateSegment, deleteSegment } from '../controllers/segmentController';
import { prisma } from '../db/prisma';
import { AppError } from '../utils/AppError';

const router = Router();

// Segment routes
router.get('/', getSegments);
router.post('/', createSegment);
router.put('/:id', updateSegment);
router.delete('/:id', deleteSegment);

// Tag CRUD routes under /api/segments/tags
router.get('/tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } });
    res.status(200).json({ status: 'success', data: { tags } });
  } catch (error) { next(error); }
});

router.post('/tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, color, category, description } = req.body;
    if (!name) throw new AppError('Le nom du tag est requis', 400);
    const tag = await prisma.tag.create({
      data: { name, color: color || '#35B8B2', category, description }
    });
    res.status(201).json({ status: 'success', data: { tag } });
  } catch (error) { next(error); }
});

router.put('/tags/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, color, category, description } = req.body;
    const tag = await prisma.tag.update({
      where: { id },
      data: { name, color, category, description }
    });
    res.status(200).json({ status: 'success', data: { tag } });
  } catch (error) { next(error); }
});

router.delete('/tags/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.tag.delete({ where: { id } });
    res.status(200).json({ status: 'success', data: { success: true } });
  } catch (error) { next(error); }
});

export default router;
