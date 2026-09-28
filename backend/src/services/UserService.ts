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
    
    // Sem controle de acesso: qualquer um pode se cadastrar direto sem pré-cadastro
    let finalRole: 'admin' | 'user' = userData.role || 'user';

    try {
      const authDoc = await db.collection('authorized_emails').doc(cleanEmail).get();
      if (authDoc.exists) {
        const authData = authDoc.data();
        if (authData?.role) {
          finalRole = authData.role;
        }
        await authDoc.ref.update({ 
          status: 'registered', 
          registeredAt: new Date(),
          uid: userData.id,
          role: finalRole
        });
      }
    } catch (authDocErr) {
      console.warn('authorized_emails não consultado/erro ignorado:', authDocErr);
    }

    userData.email = cleanEmail;
    userData.role = finalRole;
    userData.createdAt = new Date();

    const user = await this.userRepository.saveUser(userData);
    
    // Sincroniza Custom Claims no Firebase Auth para admin/user
    try {
      await firebaseAuth.setCustomUserClaims(userData.id, { role: finalRole });
    } catch (claimErr) {
      console.warn('Erro ao aplicar custom claims no Firebase Auth:', claimErr);
    }
    
    return user;
  }

  public async listUsers(): Promise<Omit<IUser, 'password' | 'securityAnswer'>[]> {
    const users = await this.userRepository.findAll();
    const userMap = new Map<string, Omit<IUser, 'password' | 'securityAnswer'>>();

    users.forEach(u => {
      const { password, securityAnswer, ...safeUser } = u;
      userMap.set(u.id, safeUser);
    });

    try {
      const listAuthUsers = await firebaseAuth.listUsers(100);
      for (const authUser of listAuthUsers.users) {
        if (!userMap.has(authUser.uid)) {
          const newUser: Omit<IUser, 'password' | 'securityAnswer'> = {
            id: authUser.uid,
            email: authUser.email || '',
            name: authUser.displayName || authUser.email?.split('@')[0] || 'Usuário',
            avatarUrl: authUser.photoURL || undefined,
            role: (authUser.customClaims?.role as any) || 'user',
            createdAt: authUser.metadata.creationTime ? new Date(authUser.metadata.creationTime) : new Date(),
          };
          userMap.set(authUser.uid, newUser);
        } else {
          const existing = userMap.get(authUser.uid)!;
          if (!existing.email && authUser.email) existing.email = authUser.email;
          if (!existing.name && authUser.displayName) existing.name = authUser.displayName;
          if (!existing.avatarUrl && authUser.photoURL) existing.avatarUrl = authUser.photoURL;
        }
      }
    } catch (authErr) {
      console.warn('Aviso: Não foi possível sincronizar com listUsers do Firebase Auth:', authErr);
    }

    return Array.from(userMap.values());
  }

  public async getUserProfile(id: string): Promise<Omit<IUser, 'password' | 'securityAnswer'> | null> {
    const user = await this.userRepository.findById(id);
    if (user) {
      const { password, securityAnswer, ...userData } = user;
      return userData;
    }

    // Fallback: se não estiver no Firestore, tenta buscar no Firebase Auth
    try {
      const authUser = await firebaseAuth.getUser(id);
      if (authUser) {
        return {
          id: authUser.uid,
          email: authUser.email || '',
          name: authUser.displayName || authUser.email?.split('@')[0] || 'Usuário',
          avatarUrl: authUser.photoURL || undefined,
          role: (authUser.customClaims?.role as any) || 'user',
          createdAt: authUser.metadata.creationTime ? new Date(authUser.metadata.creationTime) : new Date(),
        };
      }
    } catch (err) {
      // Ignora erro se não encontrar
    }

    return null;
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
