import { Router } from 'express';
import contactRoutes from './contactRoutes';
import dashboardRoutes from './dashboardRoutes';
import authRoutes from './authRoutes';
import segmentRoutes from './segmentRoutes';
import importRoutes from './importRoutes';
import exportRoutes from './exportRoutes';
import uploadRoutes from './uploadRoutes';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/contacts', contactRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/segments', segmentRoutes);
apiRouter.use('/import', importRoutes);
apiRouter.use('/export', exportRoutes);
apiRouter.use('/uploads', uploadRoutes);

export default apiRouter;
