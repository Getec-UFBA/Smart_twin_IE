import { auth as firebaseAuth, db } from '../config/firebase';
import { IUser } from '../models/IUser';
import UserRepository from '../repositories/UserRepository';

class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  public async isEmailAuthorized(email: string): Promise<boolean> {
    const doc = await db.collection('authorized_emails').doc(email.toLowerCase()).get();
    return doc.exists;
  }

  public async registerUser(userData: IUser): Promise<IUser> {
    const authDoc = await db.collection('authorized_emails').doc(userData.email.toLowerCase()).get();
    
    if (!authDoc.exists) {
      throw new Error('Este e-mail não está autorizado para cadastro.');
    }

    const authData = authDoc.data();
    // Aplica a role que foi pré-definida pelo admin
    userData.role = authData?.role || 'user';
    userData.createdAt = new Date();

    const user = await this.userRepository.saveUser(userData);
    
    // Atualiza o status na coleção de autorizados para concluído
    await authDoc.ref.update({ 
      status: 'registered', 
      registeredAt: new Date(),
      uid: userData.id 
    });
    
    return user;
  }

  public async authorizeEmail(email: string, role: 'admin' | 'user' = 'user'): Promise<void> {
    await db.collection('authorized_emails').doc(email.toLowerCase()).set({
      authorizedAt: new Date(),
      status: 'pending',
      role: role
    });
  }

  public async listAuthorizedEmails(): Promise<any[]> {
    const snapshot = await db.collection('authorized_emails').get();
    return snapshot.docs.map(doc => ({ email: doc.id, ...doc.data() }));
  }
}

export default UserService;
