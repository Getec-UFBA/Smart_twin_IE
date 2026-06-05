import UserRepository from '../repositories/UserRepository';
import { IUser } from '../models/IUser';
import { storage } from '../config/firebase';

interface IRequest {
  userId: string;
  avatarUrl: string; // URL já vinda do Firebase Storage (Frontend)
}

class UpdateAvatarService {
  private userRepository = new UserRepository();
  private bucket = storage.bucket();

  public async execute({ userId, avatarUrl }: IRequest): Promise<Omit<IUser, 'password' | 'securityAnswer'>> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    // Se quisermos apagar o avatar antigo no Firebase Storage
    if (user.avatarUrl && user.avatarUrl.includes('storage.googleapis.com')) {
      try {
        // Extrai o caminho relativo do arquivo no bucket da URL
        const parts = user.avatarUrl.split(`${this.bucket.name}/`);
        if (parts.length > 1) {
          const fileName = parts[1].split('?')[0]; // Remove query params se houver
          const file = this.bucket.file(decodeURIComponent(fileName));
          
          const [exists] = await file.exists();
          if (exists) {
            await file.delete();
            console.log(`Avatar antigo deletado: ${fileName}`);
          }
        }
      } catch (error) {
        // Logamos o erro mas permitimos que o processo continue
        console.error('Aviso: Não foi possível deletar o avatar antigo no Storage:', error);
      }
    }

    user.avatarUrl = avatarUrl;
    await this.userRepository.updateUser({
      ...user,
      id: userId,
      avatarUrl
    });

    const updatedUser = await this.userRepository.findById(userId);
    if (!updatedUser) throw new Error('Falha ao recuperar usuário atualizado.');

    const { password, securityAnswer, ...userWithoutSensitiveData } = updatedUser;
    return { ...userWithoutSensitiveData, id: userId };
  }
}

export default UpdateAvatarService;
