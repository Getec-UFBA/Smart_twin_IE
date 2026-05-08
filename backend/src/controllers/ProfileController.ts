import { Request, Response } from 'express';
import UpdateProfileService from '../services/UpdateProfileService';
import UpdateAvatarService from '../services/UpdateAvatarService';
import UserRepository from '../repositories/UserRepository';
import { AuthRequest } from '../middlewares/auth'; 

class ProfileController {
  // GET /profile/me
  public async show(req: AuthRequest, res: Response): Promise<Response> {
    const userId = req.userId;
    const userRepository = new UserRepository();

    if (!userId) {
      return res.status(400).json({ error: 'ID do usuário não encontrado no token.' });
    }

    const user = await userRepository.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const { password, securityAnswer, ...userWithoutSensitiveData } = user;
    return res.json(userWithoutSensitiveData);
  }

  // PUT /profile/me
  public async update(req: AuthRequest, res: Response): Promise<Response> {
    const userId = req.userId;
    const { name, company, bio } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'ID do usuário não encontrado no token.' });
    }

    try {
      const updateProfile = new UpdateProfileService();
      const updatedUser = await updateProfile.execute({ userId, name, company, bio });

      return res.json(updatedUser);
    } catch (error: any) {
      console.error('Erro ao atualizar perfil:', error);
      return res.status(400).json({ error: error.message || 'Erro interno ao atualizar perfil.' });
    }
  }

  // PATCH /profile/avatar
  public async updateAvatar(req: AuthRequest, res: Response): Promise<Response> {
    const userId = req.userId;
    const { avatarUrl } = req.body;

    if (!userId || !avatarUrl) {
      return res.status(400).json({ error: 'ID do usuário ou URL do avatar não encontrado.' });
    }

    try {
      const updateAvatar = new UpdateAvatarService();
      const updatedUser = await updateAvatar.execute({
        userId,
        avatarUrl,
      });

      return res.json(updatedUser);
    } catch (error: any) {
      console.error('Erro ao atualizar avatar:', error);
      return res.status(400).json({ error: error.message || 'Erro interno ao atualizar avatar.' });
    }
  }
}

export default ProfileController;
