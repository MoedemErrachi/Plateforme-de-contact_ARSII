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

const TAG_COLORS = [
  'bg-emerald-100 text-emerald-800 border-emerald-300',
  'bg-[#005596]/15 text-[#005596] border-[#005596]/30',
  'bg-[#B8167C]/15 text-[#B8167C] border-[#B8167C]/30',
  'bg-amber-100 text-amber-800 border-amber-300',
  'bg-rose-100 text-rose-800 border-rose-300',
  'bg-blue-100 text-blue-800 border-blue-300',
  'bg-cyan-100 text-cyan-800 border-cyan-300',
  'bg-purple-100 text-purple-800 border-purple-300',
  'bg-slate-100 text-slate-800 border-slate-300',
];

function randomTagColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}

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
      data: { name, color: color || randomTagColor(), description }
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
