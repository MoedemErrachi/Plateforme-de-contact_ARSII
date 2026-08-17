import { Router } from 'express';
import { getStatsAggregation } from '../controllers/statsController';
import { validate } from '../middleware/validate';
import { aggregationQuerySchema } from '../validators/contactValidator';

const router = Router();

// GET /api/stats/aggregation?group_by=gender|countryOfOrigin|facultyDepartment|researchCareerStage&<filters>
router.get('/aggregation', validate(aggregationQuerySchema), getStatsAggregation);

export default router;
