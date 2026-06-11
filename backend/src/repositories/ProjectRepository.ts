import { db } from '../config/firebase';
import { IProject } from '../models/IProject';

class ProjectRepository {
  private get collection() {
    if (!db) {
      throw new Error('Firestore database is not initialized. Check your Firebase credentials in .env');
    }
    return db.collection('projects');
  }

  public async findAll(): Promise<IProject[]> {
    try {
      console.log(`[ProjectRepository] Fetching all projects from collection: projects`);
      const snapshot = await this.collection.get();
      console.log(`[ProjectRepository] Snapshot size: ${snapshot.size}`);
      const projects = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data } as IProject;
      });
      return projects;
    } catch (error) {
      console.error('[ProjectRepository] Error fetching projects:', error);
      throw error;
    }
  }

  public async findByUserId(userId: string): Promise<IProject[]> {
    const snapshot = await this.collection.where('userId', '==', userId).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IProject));
  }

  public async findById(projectId: string): Promise<IProject | undefined> {
    const doc = await this.collection.doc(projectId).get();
    if (!doc.exists) return undefined;
    return { id: doc.id, ...doc.data() } as IProject;
  }

  public async create(projectData: IProject): Promise<IProject> {
    const { id, ...data } = projectData;
    await this.collection.doc(id).set(data);
    return projectData;
  }

  public async delete(projectId: string): Promise<void> {
    await this.collection.doc(projectId).delete();
  }

  public async update(projectId: string, updatedData: Partial<IProject>): Promise<IProject | undefined> {
    const { id, ...data } = updatedData;
    await this.collection.doc(projectId).update(data as any);
    return this.findById(projectId);
  }
}

export default ProjectRepository;
