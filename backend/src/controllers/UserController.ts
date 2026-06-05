import { Request, Response } from 'express';
import UserService from '../services/UserService';
import { AuthRequest } from '../middlewares/auth';

class UserController {
  public async create(req: Request, res: Response): Promise<Response> {
    const { id, email, name, company, role } = req.body;
    const userService = new UserService();

    try {
      const user = await userService.registerUser({
        id, // UID vindo do Firebase Auth no Frontend
        email,
        name,
        company,
        role: role || 'user',
      });

      return res.status(201).json(user);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  }

  // Método para o Admin autorizar um novo e-mail
  public async authorize(req: AuthRequest, res: Response): Promise<Response> {
    const { email, role } = req.body;
    const userService = new UserService();

    try {
      await userService.authorizeEmail(email, role);
      return res.status(200).json({ message: 'E-mail autorizado com sucesso.' });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  }

  public async listAuthorized(req: AuthRequest, res: Response): Promise<Response> {
    const userService = new UserService();
    try {
      const emails = await userService.listAuthorizedEmails();
      return res.json(emails);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  }
}

export default new UserController();
