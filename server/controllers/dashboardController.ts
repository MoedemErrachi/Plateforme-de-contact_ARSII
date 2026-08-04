import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboardService';

const dashboardService = new DashboardService();

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await dashboardService.getDashboardStats();

    res.status(200).json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    next(error);
  }
};
