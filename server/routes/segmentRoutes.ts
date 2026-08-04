import { Router } from 'express';
import { getSegments, createSegment, updateSegment, deleteSegment } from '../controllers/segmentController';

const router = Router();

router.get('/', getSegments);
router.post('/', createSegment);
router.put('/:id', updateSegment);
router.delete('/:id', deleteSegment);

export default router;
