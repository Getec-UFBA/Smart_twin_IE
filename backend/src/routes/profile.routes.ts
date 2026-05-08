import { Router } from 'express';
import multer from 'multer';
import uploadConfig from '../config/upload';
import ProfileController from '../controllers/ProfileController';
import { authenticateToken } from '../middlewares/auth';

const profileRouter = Router();
const uploadAvatar = multer({ storage: uploadConfig.storage(uploadConfig.avatarsDirectory) });
const profileController = new ProfileController();

// Todas as rotas de perfil precisam de autenticação
profileRouter.use(authenticateToken);

profileRouter.get('/me', profileController.show);
profileRouter.put('/me', profileController.update);
profileRouter.patch('/avatar', profileController.updateAvatar);

export default profileRouter;
