import { db } from '../config/firebase';
import { IUser } from '../models/IUser';

class UserRepository {
  private collection = db.collection('users');

  public async findByEmail(email: string): Promise<IUser | undefined> {
    const snapshot = await this.collection.where('email', '==', email.toLowerCase()).get();
    if (snapshot.empty) return undefined;
    return snapshot.docs[0].data() as IUser;
  }

  public async findById(id: string): Promise<IUser | undefined> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return undefined;
    return doc.data() as IUser;
  }

  public async saveUser(user: IUser): Promise<IUser> {
    // Usamos o ID do Firebase Auth (UID) como ID do documento no Firestore
    const { id, ...userData } = user;
    await this.collection.doc(id).set(userData);
    return user;
  }

  public async updateUser(updatedUser: IUser): Promise<IUser> {
    const { id, ...userData } = updatedUser;
    await this.collection.doc(id).update(userData as any);
    return updatedUser;
  }

  public async findByResetToken(token: string): Promise<IUser | undefined> {
    const snapshot = await this.collection.where('resetPasswordToken', '==', token).get();
    if (snapshot.empty) return undefined;
    return snapshot.docs[0].data() as IUser;
  }
}

export default UserRepository;
