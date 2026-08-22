import { Request, Response, NextFunction } from 'express';
import { SegmentService } from '../services/segmentService';

const segmentService = new SegmentService();

export const getSegments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await segmentService.getSegments();
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const createSegment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const segment = await segmentService.createSegment(req.body);
    res.status(201).json({ status: 'success', data: { segment } });
  } catch (error) {
    next(error);
  }
};

export const updateSegment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const segment = await segmentService.updateSegment(id, req.body);
    res.status(200).json({ status: 'success', data: { segment } });
  } catch (error) {
    next(error);
  }
};

export const deleteSegment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await segmentService.deleteSegment(id);
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const setTagContacts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { contactIds } = req.body;

    if (!Array.isArray(contactIds)) {
      res.status(400).json({ status: 'fail', message: 'contactIds doit être un tableau d\'identifiants' });
      return;
    }

    const tag = await segmentService.setTagContacts(id, contactIds);
    res.status(200).json({ status: 'success', data: { tag } });
  } catch (error) {
    next(error);
  }
};
