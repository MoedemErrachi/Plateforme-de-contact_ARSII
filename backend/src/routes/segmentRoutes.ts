import { Router, Request, Response, NextFunction } from 'express';
import { getSegments, createSegment, updateSegment, deleteSegment, setTagContacts } from '../controllers/segmentController';
import { prisma } from '../config/prisma';
import { requirePrivilege } from '../middleware/authorizeRole';
import { validate } from '../middleware/validate';
import {
  createSegmentSchema,
  updateSegmentSchema,
  deleteSegmentSchema,
  createTagSchema,
  updateTagSchema,
  deleteTagSchema,
  setTagContactsSchema
} from '../validators/segmentValidator';

const router = Router();

// Segment routes
router.get('/', getSegments);
router.post('/', requirePrivilege('READ_WRITE'), validate(createSegmentSchema), createSegment);
router.put('/:id', requirePrivilege('READ_WRITE'), validate(updateSegmentSchema), updateSegment);
router.delete('/:id', requirePrivilege('FULL_ACCESS'), validate(deleteSegmentSchema), deleteSegment);

// Tag CRUD routes under /api/segments/tags
router.get('/tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { contacts: true } } }
    });
    res.status(200).json({ status: 'success', data: { tags } });
  } catch (error) { next(error); }
});

router.post('/tags', requirePrivilege('READ_WRITE'), validate(createTagSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, color, description } = req.body;
    const tag = await prisma.tag.create({
      data: { name, color: color || null, description }
    });
    res.status(201).json({ status: 'success', data: { tag } });
  } catch (error) { next(error); }
});

router.put('/tags/:id', requirePrivilege('READ_WRITE'), validate(updateTagSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, color, description } = req.body;
    const tag = await prisma.tag.update({
      where: { id },
      data: { name, color, description }
    });
    res.status(200).json({ status: 'success', data: { tag } });
  } catch (error) { next(error); }
});

router.delete('/tags/:id', requirePrivilege('FULL_ACCESS'), validate(deleteTagSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.tag.delete({ where: { id } });
    res.status(200).json({ status: 'success', data: { success: true } });
  } catch (error) { next(error); }
});

router.put('/tags/:id/contacts', requirePrivilege('READ_WRITE'), validate(setTagContactsSchema), setTagContacts);

export default router;
