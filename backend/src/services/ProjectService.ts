import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import uploadConfig from '../config/upload';
import ProjectRepository from '../repositories/ProjectRepository';
import { IProject, IOAE, IInspection, IDetection, IImage, IOrthoResult } from '../models/IProject';

interface IFile {
  fieldname: string;
  filename: string;
}

interface ICreateRequest {
  userId: string;
  name: string;
  address: string;
  type: string;
  responsible: string;
  modules: string;
  oaeData: string;
  files: IFile[];
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

  public async create({ 
    userId, 
    name, 
    address, 
    type, 
    responsible, 
    modules, 
    oaeData, 
    files,
    buildingYear, 
    builtArea,    
    facadeTypology, 
    roofTypology,  
    buildingAcronym, 
    unitDirector   
  }: ICreateRequest): Promise<IProject> {
    const coverImage = files.find(f => f.fieldname === 'coverImage');
    const bimModel = files.find(f => f.fieldname === 'bimModel');

    if (!coverImage || !bimModel) {
      throw new Error('Imagem de capa e modelo BIM principal são obrigatórios.');
    }

    const parsedModules = JSON.parse(modules);
    const parsedOaes = oaeData ? JSON.parse(oaeData) : [];

    const oaeBimModelFiles = files.filter(f => f.fieldname === 'oaeBimModel[]');

    const oaeWithFiles: IOAE[] = parsedOaes.map((oae: any, index: number) => {
      const oaeFile = oaeBimModelFiles[index];
      if (!oaeFile) {
        throw new Error(`Arquivo BIM não encontrado para a OAE: ${oae.name}`);
      }
      return {
        id: uuidv4(),
        name: oae.name,
        bimModelUrl: oaeFile.filename,
      };
    });

    if (parsedOaes.length !== oaeBimModelFiles.length) {
      console.warn('O número de OAEs e de modelo BIM não corresponde.');
    }

    const newProject: IProject = {
      id: uuidv4(),
      userId,
      name,
      address,
      type,
      responsible,
      coverImageUrl: coverImage.filename,
      bimModelUrl: bimModel.filename,
      modules: parsedModules,
      oae: oaeWithFiles,
    };

    if (parsedModules.maintenance) {
      newProject.buildingYear = buildingYear;
      newProject.builtArea = builtArea;
      newProject.facadeTypology = facadeTypology;
      newProject.roofTypology = roofTypology;
      newProject.buildingAcronym = buildingAcronym;
      newProject.unitDirector = unitDirector;
    }

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

    const inspectionPath = path.resolve(
      uploadConfig.projectsDirectory,
      projectId,
      newInspection.id
    );
    await fs.mkdir(inspectionPath, { recursive: true });

    return newInspection;
  }

  public async addImagesToInspection({ projectId, inspectionId, images }: { projectId: string; inspectionId: string; images: IImage[] }): Promise<IProject> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new Error('Projeto não encontrado.');
    }

    const updatedInspections = project.inspections?.map(inspection => {
      if (inspection.id === inspectionId) {
        return {
          ...inspection,
          images: [...inspection.images, ...images],
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

    const updatedInspections = project.inspections?.map(inspection => {
      if (inspection.id === inspectionId) {
        return {
          ...inspection,
          orthoResults: [...(inspection.orthoResults || []), ...orthoResults],
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

    const destinationDir = path.resolve(
      uploadConfig.projectsDirectory,
      '..',
      'processed_images',
      projectId,
      inspectionId
    );
    await fs.mkdir(destinationDir, { recursive: true });
    const destinationPath = path.join(destinationDir, newFileName);
    await fs.writeFile(destinationPath, imageBuffer);

    const relativePath = `/files/processed_images/${projectId}/${inspectionId}/${newFileName}`;
    const newImage: IImage = {
      url: relativePath,
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
  
    const destinationDir = path.resolve(
      uploadConfig.projectsDirectory,
      '..',
      'processed_images',
      projectId,
      inspectionId
    );
    
    await fs.mkdir(destinationDir, { recursive: true });
    const destinationPath = path.join(destinationDir, newFileName);
    await fs.writeFile(destinationPath, imageBuffer);
  
    const relativePath = `/files/processed_images/${projectId}/${inspectionId}/${newFileName}`;
    
    const newImage: IImage = {
      url: relativePath,
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

    const filesToDelete: string[] = [];
    if (project.coverImageUrl) filesToDelete.push(project.coverImageUrl);
    if (project.bimModelUrl) filesToDelete.push(project.bimModelUrl);
    if (project.oae) {
      project.oae.forEach(o => filesToDelete.push(o.bimModelUrl));
    }

    for (const filename of filesToDelete) {
      const filePath = path.join(uploadConfig.projectsDirectory, filename);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.error(`Falha ao excluir o arquivo ${filename}:`, err);
      }
    }

    // Exclui a pasta do projeto inteira para garantir que não fiquem órfãos
    const projectPath = path.resolve(uploadConfig.projectsDirectory, projectId);
    await fs.rm(projectPath, { recursive: true, force: true }).catch(() => {});

    // Exclui a pasta de imagens processadas do projeto
    const processedPath = path.resolve(uploadConfig.projectsDirectory, '..', 'processed_images', projectId);
    await fs.rm(processedPath, { recursive: true, force: true }).catch(() => {});

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

    // Remove pasta física da inspeção (contém ortofotos)
    const inspectionPath = path.resolve(uploadConfig.projectsDirectory, projectId, inspectionId);
    await fs.rm(inspectionPath, { recursive: true, force: true }).catch(() => {});

    // Remove pasta de imagens processadas da inspeção
    const processedPath = path.resolve(uploadConfig.projectsDirectory, '..', 'processed_images', projectId, inspectionId);
    await fs.rm(processedPath, { recursive: true, force: true }).catch(() => {});
  }

  public async deleteImageFromInspection(projectId: string, inspectionId: string, imageName: string): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new Error('Projeto não encontrado.');

    const inspection = project.inspections?.find(i => i.id === inspectionId);
    if (!inspection) throw new Error('Inspeção não encontrada.');

    // Encontra a imagem para saber a URL e apagar o arquivo
    const imageToDelete = inspection.images.find(img => path.basename(img.url) === imageName);
    
    // Filtra o array
    const updatedImages = inspection.images.filter(img => path.basename(img.url) !== imageName);
    
    const updatedInspections = project.inspections?.map(i => {
      if (i.id === inspectionId) {
        return { ...i, images: updatedImages };
      }
      return i;
    }) || [];

    await this.projectRepository.update(projectId, { inspections: updatedInspections });

    // Apaga o arquivo físico
    if (imageToDelete) {
      const filePath = path.resolve(uploadConfig.projectsDirectory, '..', 'processed_images', projectId, inspectionId, imageName);
      await fs.unlink(filePath).catch(() => {});
    }
  }

  public async deleteOrthoFromInspection(projectId: string, inspectionId: string, orthoName: string): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new Error('Projeto não encontrado.');

    const inspection = project.inspections?.find(i => i.id === inspectionId);
    if (!inspection || !inspection.orthoResults) throw new Error('Inspeção ou resultados não encontrados.');

    const orthoResult = inspection.orthoResults.find(o => path.basename(o.url) === orthoName);
    
    // Filtra o array
    const updatedOrthoResults = inspection.orthoResults.filter(o => path.basename(o.url) !== orthoName);
    
    const updatedInspections = project.inspections?.map(i => {
      if (i.id === inspectionId) {
        return { ...i, orthoResults: updatedOrthoResults };
      }
      return i;
    }) || [];

    await this.projectRepository.update(projectId, { inspections: updatedInspections });

    // Apaga os arquivos físicos (GeoTIFF e Preview)
    if (orthoResult) {
      const orthoPath = path.resolve(uploadConfig.projectsDirectory, projectId, inspectionId, orthoName);
      await fs.unlink(orthoPath).catch(() => {});
      
      if (orthoResult.previewUrl) {
        const previewName = path.basename(orthoResult.previewUrl);
        const previewPath = path.resolve(uploadConfig.projectsDirectory, projectId, inspectionId, previewName);
        await fs.unlink(previewPath).catch(() => {});
      }
    }
  }
}

export default ProjectService;
