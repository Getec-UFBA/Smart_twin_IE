import { Router } from 'express';
import authRouter from './auth.routes';
import userRouter from './user.routes';
import profileRouter from './profile.routes';
import projectRouter from './project.routes';
import { admin } from '../config/firebase';

const routes = Router();

routes.get('/debug-fb', (req, res) => {
  res.json({
    projectId: admin.apps[0]?.options.credential ? (admin.apps[0]?.options as any).projectId : 'unknown',
    appsCount: admin.apps.length
  });
});

routes.use('/auth', authRouter);
routes.use('/users', userRouter);
routes.use('/profile', profileRouter);
routes.use('/projects', projectRouter);

export default routes;
