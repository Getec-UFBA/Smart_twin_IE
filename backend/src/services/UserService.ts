import { auth as firebaseAuth, db } from '../config/firebase';
import { IUser } from '../models/IUser';
import UserRepository from '../repositories/UserRepository';

class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  public async isEmailAuthorized(email: string): Promise<boolean> {
    const cleanEmail = email.toLowerCase().trim();
    const doc = await db.collection('authorized_emails').doc(cleanEmail).get();
    return doc.exists;
  }

  public async registerUser(userData: IUser): Promise<IUser> {
    const cleanEmail = userData.email.toLowerCase().trim();
    const authDoc = await db.collection('authorized_emails').doc(cleanEmail).get();
    
    if (!authDoc.exists) {
      throw new Error('Este e-mail não está autorizado para cadastro.');
    }

    const authData = authDoc.data();
    // Aplica a role que foi pré-definida pelo admin
    const finalRole: 'admin' | 'user' = authData?.role || 'user';
    userData.email = cleanEmail;
    userData.role = finalRole;
    userData.createdAt = new Date();

    const user = await this.userRepository.saveUser(userData);
    
    // Atualiza o status na coleção de autorizados para concluído
    await authDoc.ref.update({ 
      status: 'registered', 
      registeredAt: new Date(),
      uid: userData.id,
      role: finalRole
    });

    // Sincroniza Custom Claims no Firebase Auth para admin
    try {
      await firebaseAuth.setCustomUserClaims(userData.id, { role: finalRole });
    } catch (claimErr) {
      console.warn('Erro ao aplicar custom claims no Firebase Auth:', claimErr);
    }
    
    return user;
  }

  public async authorizeEmail(email: string, role: 'admin' | 'user' = 'user'): Promise<void> {
    const cleanEmail = email.toLowerCase().trim();
    let existingUid: string | null = null;

    // 1. Se o usuário já existe na coleção 'users' do Firestore, atualiza sua role imediatamente
    const existingUser = await this.userRepository.findByEmail(cleanEmail);
    if (existingUser) {
      existingUid = existingUser.id;
      existingUser.role = role;
      await this.userRepository.updateUser(existingUser);
    }

    // 2. Se o usuário já está criado no Firebase Auth, garante sincronização no Firestore e nas Claims
    try {
      const authUser = await firebaseAuth.getUserByEmail(cleanEmail);
      if (authUser) {
        existingUid = authUser.uid;
        await db.collection('users').doc(authUser.uid).set({
          email: cleanEmail,
          role: role,
        }, { merge: true });

        await firebaseAuth.setCustomUserClaims(authUser.uid, { role });
      }
    } catch (authError) {
      // Usuário ainda não registrado no Firebase Auth (normal em novos pré-cadastros)
    }

    // 3. Salva / atualiza o registro na coleção authorized_emails
    await db.collection('authorized_emails').doc(cleanEmail).set({
      authorizedAt: new Date(),
      status: existingUid ? 'registered' : 'pending',
      role: role,
      ...(existingUid ? { uid: existingUid } : {})
    }, { merge: true });
  }

  public async listAuthorizedEmails(): Promise<any[]> {
    const snapshot = await db.collection('authorized_emails').get();
    return snapshot.docs.map(doc => ({ email: doc.id, ...doc.data() }));
  }
}

export default UserService;
