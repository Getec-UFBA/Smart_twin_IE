import { Router } from 'express';
import UserController from '../controllers/UserController';
import { authenticateToken, authorizeRole } from '../middlewares/auth';

const userRoutes = Router();

// Rota pública para finalizar o cadastro (chamada pelo frontend após o Firebase Auth)
userRoutes.post('/', UserController.create);

// Rota protegida: Apenas Admin pode autorizar novos e-mails
userRoutes.post('/authorize', authenticateToken, authorizeRole(['admin']), UserController.authorize);
userRoutes.get('/authorized', authenticateToken, authorizeRole(['admin']), UserController.listAuthorized);

export default userRoutes;
