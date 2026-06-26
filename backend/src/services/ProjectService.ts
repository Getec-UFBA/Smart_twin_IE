import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { storage } from '../config/firebase';
import ProjectRepository from '../repositories/ProjectRepository';
import { IProject, IOAE, IInspection, IDetection, IImage, IOrthoResult } from '../models/IProject';

interface ICreateRequest {
  userId: string;
  name: string;
  address: string;
  type: string;
  responsible: string;
  modules: string;
  oaeData: string;
  coverImageUrl: string; // URL já vinda do Firebase Storage (Frontend)
  bimModelUrl: string;   // URL já vinda do Firebase Storage (Frontend)
  oaeBimModelUrls: string[]; // Lista de URLs vindas do Frontend
  buildingYear?: string;
  builtArea?: string;
  facadeTypology?: string;
  roofTypology?: string;
  buildingAcronym?: string;
  unitDirector?: string;
}

export interface IUpdateRequest {
  projectId: string;
  data: Partial<IProject>;
}

interface ICreateInspectionRequest {
  projectId: string;
  inspectionType: string;
  inspectionObjective: string;
  inspectionDate: string;
  inspectionResponsible: string;
}

interface ISaveImageToInspectionRequest {
  projectId: string;
  inspectionId: string;
  imageData: string;
  detections: IDetection[];
}

export interface ISaveReviewedImageRequest {
  projectId: string;
  inspectionId: string;
  base64Data: string;
  detections: IDetection[];
  originalFileName: string;
}

class ProjectService {
  private projectRepository = new ProjectRepository();
  private bucket = storage.bucket();

  public async create({ 
    userId, 
    name, 
    address, 
    type, 
    responsible, 
    modules, 
    oaeData, 
    coverImageUrl,
    bimModelUrl,
    oaeBimModelUrls,
    buildingYear, 
    builtArea,    
    facadeTypology, 
    roofTypology,  
    buildingAcronym, 
    unitDirector   
  }: ICreateRequest): Promise<IProject> {
    const parsedModules = JSON.parse(modules);
    const parsedOaes = oaeData ? JSON.parse(oaeData) : [];

    const oaeWithFiles: IOAE[] = parsedOaes.map((oae: any, index: number) => {
      const oaeUrl = oaeBimModelUrls[index];
      if (!oaeUrl) {
        throw new Error(`URL do modelo BIM não encontrada para a OAE: ${oae.name}`);
      }
      return {
        id: uuidv4(),
        name: oae.name,
        bimModelUrl: oaeUrl,
      };
    });

    const newProject: IProject = {
      id: uuidv4(),
      userId,
      name,
      address,
      type,
      responsible,
      coverImageUrl,
      bimModelUrl,
      modules: parsedModules,
      oae: oaeWithFiles,
    };

    newProject.buildingYear = buildingYear;
    newProject.builtArea = builtArea;
    newProject.facadeTypology = facadeTypology;
    newProject.roofTypology = roofTypology;
    newProject.buildingAcronym = buildingAcronym;
    newProject.unitDirector = unitDirector;

    return this.projectRepository.create(newProject);
  }

  public async update({ projectId, data }: IUpdateRequest): Promise<IProject> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new Error('Projeto não encontrado.');
    }

    const updatedProject = await this.projectRepository.update(projectId, data);

    if (!updatedProject) {
      throw new Error('Falha ao atualizar o projeto.');
    }

    return updatedProject;
  }

  public async createInspection({
    projectId,
    inspectionType,
    inspectionObjective,
    inspectionDate,
    inspectionResponsible,
  }: ICreateInspectionRequest): Promise<IInspection> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new Error('Projeto não encontrado.');
    }

    if (project.inspections?.some(inspection => inspection.inspectionObjective === inspectionObjective)) {
      throw new Error(`A inspeção com objetivo "${inspectionObjective}" já existe.`);
    }

    const newInspection: IInspection = {
      id: uuidv4(),
      inspectionType,
      inspectionObjective,
      inspectionDate,
      inspectionResponsible,
      images: [],
    };

    const updatedInspections = project.inspections ? [...project.inspections, newInspection] : [newInspection];

    await this.projectRepository.update(projectId, { inspections: updatedInspections });

    return newInspection;
  }

  public async addImagesToInspection({ projectId, inspectionId, images }: { projectId: string; inspectionId: string; images: IImage[] }): Promise<IProject> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new Error('Projeto não encontrado.');
    }

    // Garante que todas as detecções tenham ID e status inicial
    const imagesWithIds = images.map(img => ({
      ...img,
      detections: img.detections?.map(det => ({
        ...det,
        id: det.id || uuidv4(),
        status: det.status || 'pending'
      }))
    }));

    const updatedInspections = project.inspections?.map(inspection => {
      if (inspection.id === inspectionId) {
        return {
          ...inspection,
          images: [...inspection.images, ...imagesWithIds],
        };
      }
      return inspection;
    }) || [];

    const updatedProject = await this.projectRepository.update(projectId, { inspections: updatedInspections });

    if (!updatedProject) {
      throw new Error('Falha ao adicionar imagens à inspeção.');
    }

    return updatedProject;
  }

  public async addOrthoResultsToInspection({ projectId, inspectionId, orthoResults }: { projectId: string; inspectionId: string; orthoResults: IOrthoResult[] }): Promise<IProject> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new Error('Projeto não encontrado.');
    }

    // Garante que todas as detecções tenham ID e status inicial
    const orthoWithIds = orthoResults.map(ortho => ({
      ...ortho,
      detections: ortho.detections.map(det => ({
        ...det,
        id: det.id || uuidv4(),
        status: det.status || 'pending'
      }))
    }));

    const updatedInspections = project.inspections?.map(inspection => {
      if (inspection.id === inspectionId) {
        return {
          ...inspection,
          orthoResults: [...(inspection.orthoResults || []), ...orthoWithIds],
        };
      }
      return inspection;
    }) || [];

    const updatedProject = await this.projectRepository.update(projectId, { inspections: updatedInspections });

    if (!updatedProject) {
      throw new Error('Falha ao adicionar resultados de ortomosaico à inspeção.');
    }

    return updatedProject;
  }

  public async updateDetectionMaintenance({
    projectId,
    inspectionId,
    detectionIds,
    maintenanceAt,
    maintenanceResponsible,
    maintenanceNotes,
    maintenanceCost,
    status
  }: {
    projectId: string;
    inspectionId: string;
    detectionIds: string[];
    maintenanceAt?: string;
    maintenanceResponsible?: string;
    maintenanceNotes?: string;
    maintenanceCost?: number;
    status: 'pending' | 'resolved';
  }): Promise<IProject> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new Error('Projeto não encontrado.');

    const updatedInspections = project.inspections?.map(inspection => {
      if (inspection.id === inspectionId) {
        // Atualiza em imagens
        const updatedImages = inspection.images.map(img => ({
          ...img,
          detections: img.detections?.map(det => {
            if (detectionIds.includes(det.id)) {
              return { 
                ...det, 
                maintenanceAt, 
                maintenanceResponsible, 
                maintenanceNotes,
                maintenanceCost,
                status 
              };
            }
            return det;
          })
        }));

        // Atualiza em OrtoResults
        const updatedOrthoResults = inspection.orthoResults?.map(ortho => ({
          ...ortho,
          detections: ortho.detections.map(det => {
            if (detectionIds.includes(det.id)) {
              return { 
                ...det, 
                maintenanceAt, 
                maintenanceResponsible, 
                maintenanceNotes,
                maintenanceCost,
                status 
              };
            }
            return det;
          })
        }));

        return {
          ...inspection,
          images: updatedImages,
          orthoResults: updatedOrthoResults
        };
      }
      return inspection;
    });

    const updatedProject = await this.projectRepository.update(projectId, { inspections: updatedInspections });
    if (!updatedProject) throw new Error('Falha ao atualizar manutenção das detecções.');

    return updatedProject;
  }

  public async saveImageToInspection({
    projectId,
    inspectionId,
    imageData,
    detections,
  }: ISaveImageToInspectionRequest): Promise<IImage> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error('Projeto não encontrado.');
    }

    const inspection = project.inspections?.find(insp => insp.id === inspectionId);
    if (!inspection) {
      throw new Error('Inspeção não encontrada.');
    }

    const base64Data = imageData.replace(/^data:image\/jpeg;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const newFileName = `${uuidv4()}.jpg`;

    const storagePath = `projects/${projectId}/inspections/${inspectionId}/images/${newFileName}`;
    const file = this.bucket.file(storagePath);
    
    await file.save(imageBuffer, {
      metadata: { contentType: 'image/jpeg' },
      public: true
    });

    const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${storagePath}`;

    const newImage: IImage = {
      url: publicUrl,
      detections,
    };

    await this.addImagesToInspection({ projectId, inspectionId, images: [newImage] });

    return newImage;
  }

  public async saveReviewedImage({
    projectId,
    inspectionId,
    base64Data,
    detections,
    originalFileName,
  }: ISaveReviewedImageRequest): Promise<IImage> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error('Projeto não encontrado.');
    }
  
    const inspection = project.inspections?.find(insp => insp.id === inspectionId);
    if (!inspection) {
      throw new Error('Inspeção não encontrada.');
    }
  
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const fileExtension = path.extname(originalFileName);
    const newFileName = `${uuidv4()}${fileExtension}`;
  
    const storagePath = `projects/${projectId}/inspections/${inspectionId}/images/${newFileName}`;
    const file = this.bucket.file(storagePath);
    
    await file.save(imageBuffer, {
      metadata: { contentType: `image/${fileExtension.replace('.', '')}` },
      public: true
    });

    const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${storagePath}`;
    
    const newImage: IImage = {
      url: publicUrl,
      detections,
    };
  
    await this.addImagesToInspection({ projectId, inspectionId, images: [newImage] });
  
    return newImage;
  }

  public async delete({ projectId, userRole }: { projectId: string; userRole: 'admin' | 'user' }): Promise<void> {
    if (userRole !== 'admin') {
      throw new Error('Você não tem permissão para excluir este projeto.');
    }

    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new Error('Projeto não encontrado.');
    }

    // No Firebase Storage, podemos excluir uma "pasta" deletando todos os arquivos com o prefixo
    await this.bucket.deleteFiles({
      prefix: `projects/${projectId}/`
    });

    await this.projectRepository.delete(projectId);
  }

  public async deleteInspection(projectId: string, inspectionId: string): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new Error('Projeto não encontrado.');

    const inspection = project.inspections?.find(i => i.id === inspectionId);
    if (!inspection) throw new Error('Inspeção não encontrada.');

    // Remove do array
    const updatedInspections = project.inspections?.filter(i => i.id !== inspectionId) || [];
    await this.projectRepository.update(projectId, { inspections: updatedInspections });

    // Remove arquivos da inspeção no Storage
    await this.bucket.deleteFiles({
      prefix: `projects/${projectId}/inspections/${inspectionId}/`
    });
  }

  public async deleteImageFromInspection(projectId: string, inspectionId: string, imageName: string): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new Error('Projeto não encontrado.');

    const inspection = project.inspections?.find(i => i.id === inspectionId);
    if (!inspection) throw new Error('Inspeção não encontrada.');

    // Filtra o array
    const updatedImages = inspection.images.filter(img => !img.url.includes(imageName));
    
    const updatedInspections = project.inspections?.map(i => {
      if (i.id === inspectionId) {
        return { ...i, images: updatedImages };
      }
      return i;
    }) || [];

    await this.projectRepository.update(projectId, { inspections: updatedInspections });

    // Apaga o arquivo no Storage
    const storagePath = `projects/${projectId}/inspections/${inspectionId}/images/${imageName}`;
    await this.bucket.file(storagePath).delete().catch(() => {});
  }

  public async deleteOrthoFromInspection(projectId: string, inspectionId: string, orthoName: string): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new Error('Projeto não encontrado.');

    const inspection = project.inspections?.find(i => i.id === inspectionId);
    if (!inspection || !inspection.orthoResults) throw new Error('Inspeção ou resultados não encontrados.');

    // Filtra o array
    const updatedOrthoResults = inspection.orthoResults.filter(o => !o.url.includes(orthoName));
    
    const updatedInspections = project.inspections?.map(i => {
      if (i.id === inspectionId) {
        return { ...i, orthoResults: updatedOrthoResults };
      }
      return i;
    }) || [];

    await this.projectRepository.update(projectId, { inspections: updatedInspections });

    // Apaga os arquivos físicos (GeoTIFF e Preview)
    const storagePath = `projects/${projectId}/inspections/${inspectionId}/ortho/${orthoName}`;
    await this.bucket.file(storagePath).delete().catch(() => {});
    
    // Opcional: apagar o preview se estiver seguindo um padrão de nome
    const previewName = orthoName.replace('_annotated', '_preview').replace(/\..+$/, '.jpg');
    const previewPath = `projects/${projectId}/inspections/${inspectionId}/ortho/${previewName}`;
    await this.bucket.file(previewPath).delete().catch(() => {});
  }

  public async updateInspectionOrthoStatus(projectId: string, inspectionId: string, status: string | null): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) return;

    const updatedInspections = project.inspections?.map(i => {
      if (i.id === inspectionId) {
        return { ...i, orthoStatus: status };
      }
      return i;
    });

    await this.projectRepository.update(projectId, { inspections: updatedInspections });
  }
}

export default ProjectService;
