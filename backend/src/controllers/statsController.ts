import { Request, Response, NextFunction } from 'express';
import { ContactService } from '../services/contactService';
import { toArray } from '../utils/toArray';

const contactService = new ContactService();

/**
 * GET /api/stats/aggregation?group_by=...&<filters>
 * Retourne directement la map `label -> count` (consommée par l'outil
 * get_aggregation du chatbot, qui l'enveloppe dans {group_by, aggregation}).
 */
export const getStatsAggregation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupBy = typeof req.query.group_by === 'string' ? req.query.group_by : '';
    const stages = req.query.researchCareerStage ?? req.query.careerStage;

    const aggregation = await contactService.getAggregation(groupBy, {
      search: req.query.search as string,
      countryOfOrigin: toArray(req.query.countryOfOrigin),
      gender: toArray(req.query.gender),
      careerStage: toArray(stages),
      affiliation: req.query.affiliation as string,
      facultyDepartment: req.query.facultyDepartment as string,
      tagId: toArray(req.query.tagId),
      segmentId: req.query.segmentId as string
    });

    res.status(200).json(aggregation);
  } catch (error) {
    next(error);
  }
};
