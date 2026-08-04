import { Router } from 'express';
import contactRoutes from './contactRoutes';
import dashboardRoutes from './dashboardRoutes';
import authRoutes from './authRoutes';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/contacts', contactRoutes);
apiRouter.use('/dashboard', dashboardRoutes);

export default apiRouter;
