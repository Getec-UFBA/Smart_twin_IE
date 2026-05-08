import { auth } from '../config/firebase';
import UserRepository from '../repositories/UserRepository';
import { IUser } from '../models/IUser';

interface IVerifyRequest {
  idToken: string;
}

class AuthService {
  private userRepository = new UserRepository();

  /**
   * O login agora é feito no Frontend. 
   * Este serviço serve para validar o token enviado pelo frontend e retornar os dados do perfil do Firestore.
   */
  public async verifyToken({ idToken }: IVerifyRequest): Promise<{ user: IUser }> {
    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      const user = await this.userRepository.findById(decodedToken.uid);

      if (!user) {
        throw new Error('Perfil de usuário não encontrado.');
      }

      return { user };
    } catch (error) {
      throw new Error('Token inválido ou expirado.');
    }
  }
}

export default AuthService;
