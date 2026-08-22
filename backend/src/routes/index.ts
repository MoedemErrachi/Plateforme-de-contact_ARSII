import { Router } from 'express';
import contactRoutes from './contactRoutes';
import dashboardRoutes from './dashboardRoutes';
import authRoutes from './authRoutes';
import segmentRoutes from './segmentRoutes';
import searchRoutes from './searchRoutes';
import exportRoutes from './exportRoutes';
import uploadRoutes from './uploadRoutes';
import statsRoutes from './statsRoutes';
import adminRoutes from './adminRoutes';
import healthRoutes from './healthRoutes';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/contacts', contactRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/segments', segmentRoutes);
apiRouter.use('/searches', searchRoutes);
apiRouter.use('/export', exportRoutes);
apiRouter.use('/uploads', uploadRoutes);
apiRouter.use('/stats', statsRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/health', healthRoutes);

export default apiRouter;
