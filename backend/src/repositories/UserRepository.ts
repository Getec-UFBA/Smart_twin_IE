import fs from 'fs/promises';
import path from 'path';
import { IUser } from '../models/IUser';

const DB_PATH = path.resolve(__dirname, '../../db.json');

interface IDB {
  users: IUser[];
}

class UserRepository {
  private async readDB(): Promise<IDB> {
    try {
      const data = await fs.readFile(DB_PATH, 'utf-8');
      const db = JSON.parse(data) as any;
      // Converte resetPasswordExpires de string/number para Date, se existir e não for Date
      if (db.users && Array.isArray(db.users)) {
        db.users = db.users.map((user: any) => {
          if (user.resetPasswordExpires && !(user.resetPasswordExpires instanceof Date)) {
            user.resetPasswordExpires = new Date(user.resetPasswordExpires);
          }
          return user;
        });
      }
      return db as IDB;
    } catch (error) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { users: [] };
      }
      throw error;
    }
  }

  private async writeDB(data: IDB): Promise<void> {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  }

  public async findByEmail(email: string): Promise<IUser | undefined> {
    const db = await this.readDB();
    return db.users.find(user => user.email === email);
  }

  public async findById(id: string): Promise<IUser | undefined> {
    const db = await this.readDB();
    return db.users.find(user => user.id === id);
  }

  public async saveUser(user: IUser): Promise<IUser> {
    const db = await this.readDB();
    db.users.push(user);
    await this.writeDB(db);
    return user;
  }

  public async updateUser(updatedUser: IUser): Promise<IUser> {
    const db = await this.readDB();
    const userIndex = db.users.findIndex(user => user.id === updatedUser.id);

    if (userIndex === -1) {
      throw new Error('Usuário não encontrado.');
    }

    db.users[userIndex] = updatedUser;
    await this.writeDB(db);
    return updatedUser;
  }

  public async findByResetToken(token: string): Promise<IUser | undefined> {
    const db = await this.readDB();
    return db.users.find(user => user.resetPasswordToken === token);
  }
}

export default UserRepository;
