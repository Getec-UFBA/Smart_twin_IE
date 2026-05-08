import { Router } from 'express';
import AuthController from '../controllers/AuthController';

const authRouter = Router();
const authController = new AuthController();

// No Firebase Híbrido, o login do backend serve para validar o token e retornar o perfil
authRouter.post('/login', authController.login);

export default authRouter;
