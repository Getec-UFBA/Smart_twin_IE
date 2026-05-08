import { Request, Response } from 'express';
import AuthService from '../services/AuthService';

class AuthController {
  /**
   * O Frontend faz o login e pode opcionalmente chamar esta rota 
   * para validar o token e pegar os dados completos do perfil do Firestore.
   */
  public async login(req: Request, res: Response): Promise<Response> {
    const { token } = req.body; // O frontend envia o ID Token do Firebase
    const authService = new AuthService();

    try {
      const { user } = await authService.verifyToken({ idToken: token });
      return res.json({ token, user });
    } catch (error: any) {
      return res.status(401).json({ error: error.message });
    }
  }
}

export default AuthController;
