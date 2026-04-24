import { Response } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { AuthRequest } from '../middlewares/auth';
import ProjectService from '../services/ProjectService';
import ProjectRepository from '../repositories/ProjectRepository';
import ImageProcessingService from '../services/ImageProcessingService';
import ReportService from '../services/ReportService';
import { IDetection, IImage } from '../models/IProject';
import uploadConfig from '../config/upload';

// Interfaces for the review flow
interface IPendingReviewImage {
  imageId: string;
  originalFileName: string;
  detections: IDetection[];
}

interface IReviewData {
  id: string;
  images: IPendingReviewImage[];
}

class ProjectController {
  public async index(req: AuthRequest, res: Response): Promise<Response> {
    const projectRepository = new ProjectRepository();
    const projects = await projectRepository.findAll();
    return res.json(projects);
  }

  public async show(req: AuthRequest, res: Response): Promise<Response> {
    const { id } = req.params;
    const projectRepository = new ProjectRepository();
    const project = await projectRepository.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado.' });
    }
    return res.json(project);
  }

  public processImagesForResults = async (req: AuthRequest, res: Response): Promise<Response> => {
    const files = req.files as Express.Multer.File[];
    const { projectId, inspectionId } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo de imagem enviado.' });
    }

    const imageProcessingService = new ImageProcessingService();
    const projectService = new ProjectService();
    
    // Se não houver projeto/inspeção, cria uma revisão pendente (Legado ou se necessário)
    // Mas agora priorizamos o salvamento direto
    const isDirectSave = !!(projectId && inspectionId);
    const reviewId = !isDirectSave ? randomUUID() : null;
    const reviewDir = reviewId ? path.join(uploadConfig.reviewsDirectory, reviewId) : null;
    
    if (reviewDir) {
      await fs.mkdir(reviewDir, { recursive: true });
    }

    const errors: { fileName: string; error: string }[] = [];
    let processedCount = 0;

    for (const file of files) {
      try {
        const { processedImageBase64, detections } = await this.getProcessedImageData(file.path, imageProcessingService);
        
        if (isDirectSave) {
          // SALVAMENTO DIRETO NA INSPEÇÃO
          await projectService.saveReviewedImage({
            projectId,
            inspectionId,
            base64Data: processedImageBase64,
            detections,
            originalFileName: file.originalname
          });
        } else if (reviewDir && reviewId) {
          // FLUXO DE REVISÃO (LEGADO)
          const imageBuffer = Buffer.from(processedImageBase64, 'base64');
          const imageId = randomUUID();
          const imageFileName = `${imageId}.jpeg`;
          const jsonFileName = `${imageId}.json`;

          await fs.writeFile(path.join(reviewDir, imageFileName), imageBuffer);
          await fs.writeFile(path.join(reviewDir, jsonFileName), JSON.stringify({ detections, originalFileName: file.originalname }));
        }
        
        processedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing file ${file.originalname}:`, error);
        errors.push({ fileName: file.originalname, error: errorMessage });
      } finally {
        await fs.unlink(file.path).catch(err => console.error(`Failed to unlink temp file: ${file.path}`, err));
      }
    }

    if (processedCount === 0) {
      return res.status(500).json({
        message: 'Todos os arquivos falharam ao processar.',
        errors: errors,
      });
    }

    if (isDirectSave) {
      return res.status(200).json({
        message: `Sucesso: ${processedCount} imagens processadas e salvas diretamente.`,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    return res.status(200).json({
      message: 'Imagens processadas e aguardando revisão.',
      reviewId: reviewId,
      errors: errors.length > 0 ? errors : undefined,
    });
  }

  public getReview = async (req: AuthRequest, res: Response): Promise<Response> => {
    const { reviewId } = req.params;
    const reviewDir = path.join(uploadConfig.reviewsDirectory, reviewId);

    try {
      const files = await fs.readdir(reviewDir);
      const imageFiles = files.filter(f => f.endsWith('.jpeg'));
      
      const reviewImages: IPendingReviewImage[] = [];

      for (const imageFile of imageFiles) {
        const imageId = path.parse(imageFile).name;
        const jsonPath = path.join(reviewDir, `${imageId}.json`);

        const jsonContent = await fs.readFile(jsonPath, 'utf-8');
        const { detections, originalFileName } = JSON.parse(jsonContent);

        reviewImages.push({
          imageId: imageId,
          originalFileName: originalFileName,
          detections: detections,
        });
      }

      const reviewData: IReviewData = {
        id: reviewId,
        images: reviewImages,
      };

      return res.status(200).json(reviewData);

    } catch (error) {
      console.error(`Failed to get review ${reviewId}:`, error);
      return res.status(404).json({ error: 'Revisão pendente não encontrada.' });
    }
  }
  
  public getReviewImage = async (req: AuthRequest, res: Response): Promise<void> => {
    const { reviewId, imageId } = req.params;
    const imagePath = path.join(uploadConfig.reviewsDirectory, reviewId, `${imageId}.jpeg`);

    try {
      await fs.access(imagePath);
      res.sendFile(imagePath);
    } catch (error) {
      res.status(404).json({ error: 'Imagem não encontrada na revisão.' });
    }
  }

  public saveReview = async (req: AuthRequest, res: Response): Promise<Response> => {
    const { reviewId } = req.params;
    const { projectId, inspectionId } = req.body;

    if (!projectId || !inspectionId) {
      return res.status(400).json({ error: 'ID do projeto e ID da inspeção são obrigatórios.' });
    }

    const reviewDir = path.join(uploadConfig.reviewsDirectory, reviewId);
    const projectService = new ProjectService();

    try {
      const files = await fs.readdir(reviewDir);
      const imageFiles = files.filter(f => f.endsWith('.jpeg'));

      for (const imageFile of imageFiles) {
        const imageId = path.parse(imageFile).name;
        const tempImagePath = path.join(reviewDir, imageFile);
        const tempJsonPath = path.join(reviewDir, `${imageId}.json`);
        
        const jsonContent = await fs.readFile(tempJsonPath, 'utf-8');
        const { detections } = JSON.parse(jsonContent);

        const finalFileName = `${imageId}.jpeg`;
        const finalDir = path.resolve(uploadConfig.projectsDirectory, '..', 'processed_images', projectId, inspectionId);
        await fs.mkdir(finalDir, { recursive: true });
        const finalImagePath = path.join(finalDir, finalFileName);
        
        await fs.rename(tempImagePath, finalImagePath);

        const newImage: IImage = {
          url: `/files/processed_images/${projectId}/${inspectionId}/${finalFileName}`,
          detections: detections,
        };
        await projectService.addImagesToInspection({ projectId, inspectionId, images: [newImage] });
      }

      await fs.rm(reviewDir, { recursive: true, force: true });

      return res.status(200).json({ message: 'Imagens salvas na inspeção com sucesso.' });

    } catch (error) {
      console.error(`Failed to save review ${reviewId}:`, error);
      if (error instanceof Error) {
        return res.status(500).json({ error: `Erro ao salvar as imagens: ${error.message}` });
      }
      return res.status(500).json({ error: 'Erro interno do servidor ao salvar as imagens da revisão.' });
    }
  }

  public processOrthoForResults = async (req: AuthRequest, res: Response): Promise<Response> => {
    const file = req.file;
    const { projectId, inspectionId } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo GeoTIFF enviado.' });
    }

    if (!projectId || !inspectionId) {
      return res.status(400).json({ error: 'ID do projeto e ID da inspeção são obrigatórios.' });
    }

    const imageProcessingService = new ImageProcessingService();
    const projectService = new ProjectService();

    try {
      // 1. Processa no serviço de IA
      const { detections, annotated_ortho_url, preview_url } = await imageProcessingService.processOrtho(file.path);
      
      const requestUuid = randomUUID();
      const finalDir = path.resolve(uploadConfig.projectsDirectory, projectId, inspectionId);
      await fs.mkdir(finalDir, { recursive: true });

      // 2. Baixa o GeoTIFF anotado e salva
      const annotatedBuffer = await imageProcessingService.downloadFile(annotated_ortho_url);
      const finalOrthoName = `${requestUuid}_annotated${path.extname(file.originalname)}`;
      const finalOrthoPath = path.join(finalDir, finalOrthoName);
      await fs.writeFile(finalOrthoPath, annotatedBuffer);

      // 3. Baixa a imagem de pré-visualização e salva
      const previewBuffer = await imageProcessingService.downloadFile(preview_url);
      const finalPreviewName = `${requestUuid}_preview.jpg`;
      const finalPreviewPath = path.join(finalDir, finalPreviewName);
      await fs.writeFile(finalPreviewPath, previewBuffer);

      const orthoResult = {
        url: `/files/projects/${projectId}/${inspectionId}/${finalOrthoName}`,
        previewUrl: `/files/projects/${projectId}/${inspectionId}/${finalPreviewName}`,
        detections: detections,
      };

      await projectService.addOrthoResultsToInspection({
        projectId,
        inspectionId,
        orthoResults: [orthoResult],
      });

      return res.status(200).json({
        message: 'Ortomosaico processado com sucesso.',
        detections_count: detections.length,
        preview_url: orthoResult.previewUrl
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error processing ortho ${file.originalname}:`, error);
      return res.status(500).json({ error: `Falha ao processar ortomosaico: ${errorMessage}` });
    } finally {
      if (file && file.path) {
        await fs.unlink(file.path).catch(() => {});
      }
    }
  }

  private getProcessedImageData = async (imagePath: string, imageProcessingService: ImageProcessingService): Promise<{ processedImageBase64: string; detections: IDetection[] }> => {
    try {
      const processedImageResponse = await imageProcessingService.processImage(imagePath);
      return {
        processedImageBase64: processedImageResponse.processed_image_base64,
        detections: processedImageResponse.detections,
      };
    } catch (error) {
      console.error(`Error in getProcessedImageData for ${imagePath}:`, error);
      throw new Error(`Failed to process image via Python service for ${imagePath}.`);
    }
  }

  public async create(req: AuthRequest, res: Response): Promise<Response> {
    const userId = req.userId;
    const { 
      name, 
      address, 
      type, 
      responsible, 
      modules, 
      oaeData,
      buildingYear,
      builtArea,
      facadeTypology,
      roofTypology,
      buildingAcronym,
      unitDirector
    } = req.body;
    
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const allFiles = Object.values(files).flat().map(file => ({
      fieldname: file.fieldname,
      filename: file.filename
    }));
    
    if (!userId) {
      return res.status(400).json({ error: 'ID do usuário não encontrado no token.' });
    }
    
    const projectService = new ProjectService();

    try {
      const project = await projectService.create({
        userId,
        name,
        address,
        type,
        responsible,
        modules,
        oaeData,
        files: allFiles,
        buildingYear,
        builtArea,
        facadeTypology,
        roofTypology,
        buildingAcronym,
        unitDirector
      });
      return res.status(201).json(project);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }

  public async update(req: AuthRequest, res: Response): Promise<Response> {
    const { id } = req.params;
    const data = req.body;
    delete data.userId;

    const projectService = new ProjectService();

    try {
      const updatedProject = await projectService.update({ projectId: id, data });
      return res.json(updatedProject);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }

  public async delete(req: AuthRequest, res: Response): Promise<Response> {
    const userRole = req.userRole;
    const { id } = req.params;

    if (!userRole) {
      return res.status(400).json({ error: 'Role do usuário não encontrada no token.' });
    }

    const projectService = new ProjectService();

    try {
      await projectService.delete({ projectId: id, userRole });
      return res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }

  public async createInspection(req: AuthRequest, res: Response): Promise<Response> {
    const { projectId } = req.params;
    const { inspectionType, inspectionObjective, inspectionDate, inspectionResponsible } = req.body;

    if (!projectId || !inspectionObjective.trim() || !inspectionDate || !inspectionResponsible.trim()) {
      return res.status(400).json({ error: 'ID do projeto, objetivo, data e responsável pela inspeção são obrigatórios.' });
    }

    const projectService = new ProjectService();
    try {
      const newInspection = await projectService.createInspection({
        projectId,
        inspectionType,
        inspectionObjective,
        inspectionDate,
        inspectionResponsible,
      });
      return res.status(201).json(newInspection);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }

  public async deleteImageFromInspection(req: AuthRequest, res: Response): Promise<Response> {
    const { projectId, inspectionId, imageName } = req.params;

    if (!projectId || !inspectionId || !imageName) {
      return res.status(400).json({ error: 'ID do projeto, ID da inspeção e nome da imagem são obrigatórios.' });
    }

    const projectService = new ProjectService();
    try {
      await projectService.deleteImageFromInspection(projectId, inspectionId, imageName);
      return res.status(204).send();
    } catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }

  public async deleteOrthoFromInspection(req: AuthRequest, res: Response): Promise<Response> {
    const { projectId, inspectionId, orthoName } = req.params;

    if (!projectId || !inspectionId || !orthoName) {
      return res.status(400).json({ error: 'ID do projeto, ID da inspeção e nome do ortomosaico são obrigatórios.' });
    }

    const projectService = new ProjectService();
    try {
      await projectService.deleteOrthoFromInspection(projectId, inspectionId, orthoName);
      return res.status(204).send();
    } catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }

  public async deleteInspection(req: AuthRequest, res: Response): Promise<Response> {
    const { projectId, inspectionId } = req.params;

    if (!projectId || !inspectionId) {
      return res.status(400).json({ error: 'ID do projeto e ID da inspeção são obrigatórios.' });
    }
    
    const projectService = new ProjectService();
    try {
      await projectService.deleteInspection(projectId, inspectionId);
      return res.status(204).send();
    } catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }

  public async generateInspectionPdfReport(req: AuthRequest, res: Response): Promise<Response> {
    const { projectId, inspectionId } = req.params;
    const reportService = new ReportService();

    try {
      const pdfBuffer = await reportService.generatePdfReport(projectId, inspectionId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio-inspecao-${inspectionId}.pdf`);
      return res.end(pdfBuffer, 'binary');
    } catch (error) {
      console.error(`Erro ao gerar relatório PDF para a inspeção ${inspectionId} do projeto ${projectId}:`, error);
      if (error instanceof Error) {
        return res.status(500).json({ error: `Erro ao gerar relatório: ${error.message}` });
      }
      return res.status(500).json({ error: 'Erro interno do servidor ao gerar relatório PDF.' });
    }
  }

  public async saveImageToInspection(req: AuthRequest, res: Response): Promise<Response> {
    const { projectId, inspectionId } = req.params;
    const { imageData, detections } = req.body;

    if (!projectId || !inspectionId || !imageData) {
      return res.status(400).json({ error: 'ID do projeto, ID da inspeção e dados da imagem são obrigatórios.' });
    }

    const projectService = new ProjectService();
    try {
      const parsedDetections = typeof detections === 'string' ? JSON.parse(detections) : detections;
      const newImage = await projectService.saveImageToInspection({
        projectId,
        inspectionId,
        imageData,
        detections: parsedDetections,
      });
      return res.status(201).json(newImage);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }

  public async updateDetectionMaintenance(req: AuthRequest, res: Response): Promise<Response> {
    const { projectId, inspectionId } = req.params;
    const { detectionIds, maintenanceAt, maintenanceResponsible, maintenanceNotes, maintenanceCost, status } = req.body;

    if (!projectId || !inspectionId || !detectionIds || !Array.isArray(detectionIds) || !status) {
      return res.status(400).json({ error: 'ID do projeto, ID da inspeção, IDs das detecções e status são obrigatórios.' });
    }

    const projectService = new ProjectService();
    try {
      const updatedProject = await projectService.updateDetectionMaintenance({
        projectId,
        inspectionId,
        detectionIds,
        maintenanceAt: maintenanceAt || undefined,
        maintenanceResponsible: maintenanceResponsible || undefined,
        maintenanceNotes: maintenanceNotes || undefined,
        maintenanceCost: maintenanceCost ? Number(maintenanceCost) : undefined,
        status,
      });
      return res.json(updatedProject);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  }
}

export default ProjectController;
