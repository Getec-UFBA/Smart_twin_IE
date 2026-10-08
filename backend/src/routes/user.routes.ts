import { Router } from 'express';
import UserController from '../controllers/UserController';
import { authenticateToken, authorizeRole } from '../middlewares/auth';

const userRoutes = Router();

// Rota pública para finalizar o cadastro (chamada pelo frontend após o Firebase Auth)
userRoutes.post('/', UserController.create);

// Listar todos os usuários (todos os membros podem ver o perfil de todos)
userRoutes.get('/', authenticateToken, UserController.index);

// Rotas de pré-cadastro (compatibilidade, liberadas para qualquer usuário autenticado)
userRoutes.post('/authorize', authenticateToken, UserController.authorize);
userRoutes.get('/authorized', authenticateToken, UserController.listAuthorized);

// Perfil de usuário por ID
userRoutes.get('/:id', authenticateToken, UserController.show);

export default userRoutes;
