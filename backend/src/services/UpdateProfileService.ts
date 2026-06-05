import UserRepository from '../repositories/UserRepository';
import { IUser } from '../models/IUser';

interface IRequest {
  userId: string;
  name: string;
  company: string;
  bio: string;
}

class UpdateProfileService {
  private userRepository = new UserRepository();

  public async execute({ userId, name, company, bio }: IRequest): Promise<Omit<IUser, 'password' | 'securityAnswer'>> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    // Atualiza os campos do usuário
    user.name = name;
    user.company = company;
    user.bio = bio;

    // O UserRepository já foi atualizado para salvar no Firestore
    await this.userRepository.updateUser({
      ...user,
      id: userId,
      name,
      company,
      bio
    });

    const updatedUser = await this.userRepository.findById(userId);
    if (!updatedUser) throw new Error('Falha ao recuperar usuário atualizado.');

    // Retorna o usuário sem dados sensíveis
    const { password, securityAnswer, ...userWithoutSensitiveData } = updatedUser;
    return { ...userWithoutSensitiveData, id: userId };
  }
}

export default UpdateProfileService;
