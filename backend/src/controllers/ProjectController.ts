import { Request, Response } from 'express';
import crypto, { randomUUID } from 'crypto';

function getFileMd5(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fsSync.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { AuthRequest } from '../middlewares/auth';
import ProjectService from '../services/ProjectService';
import ProjectRepository from '../repositories/ProjectRepository';
import ImageProcessingService from '../services/ImageProcessingService';
import ReportService from '../services/ReportService';
import { IDetection, IImage } from '../models/IProject';
import uploadConfig from '../config/upload';
import busboy from 'busboy';

function isFutureDate(dateStr: string): boolean {
  try {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    return dateStr > todayStr;
  } catch (error) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month, day] = dateStr.split('-').map(Number);
    const inspDate = new Date(year, month - 1, day);
    return inspDate > today;
  }
}

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
    console.log(`[ProjectController] Found ${projects.length} projects`);
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

  public processImagesForResults = async (req: AuthRequest, res: Response): Promise<void> => {
    console.log('[ProjectController] Iniciando processImagesForResults via Busboy');
    
    const bb = busboy({ headers: req.headers });
    const files: { path: string; originalname: string }[] = [];
    const fields: any = {};
    const filePromises: Promise<void>[] = [];

    bb.on('field', (name: string, val: string) => {
      fields[name] = val;
    });

    bb.on('file', (name: string, file: NodeJS.ReadableStream, info: busboy.FileInfo) => {
      const { filename } = info;
      const saveTo = path.join(uploadConfig.tempDirectory, `${randomUUID()}-${filename}`);
      files.push({ path: saveTo, originalname: filename });
      
      const writeStream = fsSync.createWriteStream(saveTo);
      file.pipe(writeStream);

      const promise = new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
      filePromises.push(promise);
    });

    bb.on('finish', async () => {
      try {
        // Aguarda todos os arquivos terminarem de ser gravados no disco
        await Promise.all(filePromises);

        const { projectId, inspectionId } = fields;
        if (files.length === 0) {
          if (!res.headersSent) {
            return res.status(400).json({ error: 'Nenhum arquivo de imagem enviado.' });
          }
          return;
        }

        const imageProcessingService = new ImageProcessingService();
        const projectService = new ProjectService();
        const isDirectSave = !!(projectId && inspectionId);
        let inspection: any = null;

        if (isDirectSave) {
          const projectRepository = new ProjectRepository();
          const project = await projectRepository.findById(projectId);
          inspection = project?.inspections?.find(i => i.id === inspectionId);
          if (!project || !inspection) {
            for (const file of files) {
              await fs.unlink(file.path).catch(() => {});
            }
            if (!res.headersSent) {
              return res.status(404).json({ error: !project ? 'Projeto não encontrado.' : 'Inspeção não encontrada.' });
            }
            return;
          }
          if (isFutureDate(inspection.inspectionDate)) {
            for (const file of files) {
              await fs.unlink(file.path).catch(() => {});
            }
            console.log('[ProjectController] Data futura! inspeção agendada');
            if (!res.headersSent) {
              return res.status(400).json({ error: 'Data futura! inspeção agendada' });
            }
            return;
          }
        }

        const reviewId = !isDirectSave ? randomUUID() : null;
        const reviewDir = reviewId ? path.join(uploadConfig.reviewsDirectory, reviewId) : null;
        
        if (reviewDir) {
          await fs.mkdir(reviewDir, { recursive: true });
        }

        const warnings: string[] = [];
        const errors: { fileName: string; error: string }[] = [];
        let processedCount = 0;

        // Processa as imagens SEQUENCIALMENTE para não sobrecarregar a IA (Evita 503/502)
        for (const file of files) {
          try {
            console.log(`[ProjectController] Processando arquivo: ${file.originalname}`);

            // Detecta duplicatas
            if (isDirectSave) {
              const fileHash = await getFileMd5(file.path);
              const isDuplicate = inspection?.images?.some((img: any) => 
                img.hash === fileHash || 
                img.originalName?.toLowerCase() === file.originalname.toLowerCase()
              );
              if (isDuplicate) {
                console.log(`[ProjectController] Arquivo duplicado ignorado: ${file.originalname}`);
                warnings.push(`O arquivo "${file.originalname}" foi ignorado pois já existe nesta inspeção.`);
                await fs.unlink(file.path).catch(() => {});
                continue;
              }
            }

            const { processedImageBase64, detections } = await this.getProcessedImageData(file.path, imageProcessingService);
            
            if (isDirectSave) {
              await projectService.saveReviewedImage({
                projectId,
                inspectionId,
                base64Data: processedImageBase64,
                detections,
                originalFileName: file.originalname
              });
            } else if (reviewDir && reviewId) {
              const imageBuffer = Buffer.from(processedImageBase64, 'base64');
              const imageId = randomUUID();
              const imageFileName = `${imageId}.jpeg`;
              const jsonFileName = `${imageId}.json`;

              await fs.writeFile(path.join(reviewDir, imageFileName), imageBuffer);
              await fs.writeFile(path.join(reviewDir, jsonFileName), JSON.stringify({ detections, originalFileName: file.originalname }));
            }
            processedCount++;
          } catch (error) {
            console.error(`Error processing file ${file.originalname}:`, error);
            errors.push({ fileName: file.originalname, error: error instanceof Error ? error.message : 'Unknown error' });
          } finally {
            await fs.unlink(file.path).catch(() => {});
          }
        }

        if (processedCount === 0) {
          if (!res.headersSent) {
            if (warnings.length > 0 && errors.length === 0) {
              return res.status(200).json({
                message: 'Nenhum arquivo novo processado (arquivos duplicados ignorados).',
                warnings
              });
            }
            return res.status(500).json({ message: 'Todos os arquivos falharam ao processar.', errors, warnings });
          }
          return;
        }

        if (!res.headersSent) {
          return res.status(200).json({
            message: isDirectSave ? `Sucesso: ${processedCount} imagens processadas.` : 'Imagens aguardando revisão.',
            reviewId,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
          });
        }
      } catch (err) {
        console.error('[Busboy Finish Error]', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Erro interno ao processar upload.' });
        }
      }
    });

    bb.on('error', (err: any) => {
      console.error('[Busboy Error]', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro no stream de upload.' });
      }
    });

    // Em Firebase Functions, o corpo já pode estar em rawBody
    if ((req as any).rawBody) {
      bb.end((req as any).rawBody);
    } else {
      req.pipe(bb);
    }
  }

  public processOrthoForResults = async (req: AuthRequest, res: Response): Promise<void> => {
    console.log('[ProjectController] Iniciando processOrthoForResults via Busboy');
    
    try {
      const bb = busboy({ headers: req.headers });
      let uploadedFile: { path: string; originalname: string } | null = null;
      const fields: any = {};
      const filePromises: Promise<void>[] = [];

      bb.on('field', (name: string, val: string) => {
        fields[name] = val;
      });

      bb.on('file', (name: string, file: NodeJS.ReadableStream, info: busboy.FileInfo) => {
        const { filename } = info;
        const saveTo = path.join(uploadConfig.tempDirectory, `${randomUUID()}-${filename}`);
        uploadedFile = { path: saveTo, originalname: filename };
        
        console.log(`[ProjectController] Recebendo arquivo orto: ${filename} -> ${saveTo}`);
        const writeStream = fsSync.createWriteStream(saveTo);
        file.pipe(writeStream);

        const promise = new Promise<void>((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });
        filePromises.push(promise);
      });

      bb.on('finish', async () => {
        try {
          await Promise.all(filePromises);

          const { projectId, inspectionId } = fields;
          console.log(`[ProjectController] Upload completo do navegador para o Backend. Projeto: ${projectId}`);

          if (!uploadedFile || !projectId || !inspectionId) {
            if (!res.headersSent) res.status(400).json({ error: 'Dados incompletos no upload.' });
            return;
          }

          const projectRepository = new ProjectRepository();
          const project = await projectRepository.findById(projectId);
          const inspection = project?.inspections?.find(i => i.id === inspectionId);
          if (!project || !inspection) {
            if (uploadedFile) await fs.unlink(uploadedFile.path).catch(() => {});
            if (!res.headersSent) {
              return res.status(404).json({ error: !project ? 'Projeto não encontrado.' : 'Inspeção não encontrada.' });
            }
            return;
          }
          if (isFutureDate(inspection.inspectionDate)) {
            if (uploadedFile) await fs.unlink(uploadedFile.path).catch(() => {});
            console.log('[ProjectController] Data futura! inspeção agendada');
            if (!res.headersSent) {
              return res.status(400).json({ error: 'Data futura! inspeção agendada' });
            }
            return;
          }

          // RESPOSTA IMEDIATA: Libera o frontend agora!
          if (!res.headersSent) {
            res.status(202).json({
              message: 'Upload concluído com sucesso! O processamento foi iniciado em segundo plano pela IA. Você pode continuar usando o sistema normalmente.',
            });
          }

          // TRABALHO EM SEGUNDO PLANO (Não trava mais o navegador)
          const imageProcessingService = new ImageProcessingService();
          const host = req.get('host');
          const protocol = host?.includes('localhost') ? req.protocol : 'https';
          const hasApiPrefix = req.originalUrl.startsWith('/api/');
          const callbackUrl = `${protocol}://${host}${hasApiPrefix ? '/api' : ''}/projects/ortho-callback`;

          // Dispara para a IA sem dar 'await' no ciclo de resposta do Express
          imageProcessingService.processOrtho(uploadedFile.path, projectId, inspectionId, callbackUrl)
            .then(() => {
              console.log(`[ProjectController] IA confirmou recebimento do projeto ${projectId}`);
            })
            .catch(err => {
              console.error(`[ProjectController] FALHA crítica ao disparar IA:`, err.message);
            })
            .finally(() => {
              if (uploadedFile) fs.unlink(uploadedFile.path).catch(() => {});
            });

        } catch (error) {
          console.error('[Ortho Async Error]', error);
          if (!res.headersSent) res.status(500).json({ error: 'Erro interno ao processar arquivo.' });
        }
      });

      bb.on('error', (err: any) => {
        console.error('[Busboy Error]', err);
        if (!res.headersSent) res.status(500).json({ error: 'Erro no stream de upload.' });
      });

      if ((req as any).rawBody) {
        bb.end((req as any).rawBody);
      } else {
        req.pipe(bb);
      }
    } catch (err) {
      console.error('[Ortho Controller Error]', err);
      if (!res.headersSent) res.status(500).json({ error: 'Falha no controller.' });
    }
  }

  public handleOrthoStatus = async (req: Request, res: Response): Promise<Response> => {
    const { projectId, inspectionId, status } = req.body;
    console.log(`[ProjectController] Status da IA para ${projectId}: ${status}`);

    try {
      const projectService = new ProjectService();
      await projectService.updateInspectionOrthoStatus(projectId, inspectionId, status);
      return res.status(200).json({ message: 'Status atualizado.' });
    } catch (error) {
      return res.status(500).json({ error: 'Falha ao atualizar status.' });
    }
  }

  public handleOrthoCallback = async (req: Request, res: Response): Promise<Response> => {
    const { projectId, inspectionId, detections, annotated_ortho_url, preview_url, filename } = req.body;

    console.log(`[ProjectController] Recebido callback para o projeto ${projectId}, inspeção ${inspectionId}`);

    try {
      const imageProcessingService = new ImageProcessingService();
      const projectService = new ProjectService();
      // @ts-ignore
      const bucket = projectService.bucket;

      const requestUuid = randomUUID();

      // Download e Upload do Ortomosaico Anotado
      const annotatedBuffer = await imageProcessingService.downloadFile(annotated_ortho_url);
      const finalOrthoName = `${requestUuid}_annotated${path.extname(filename)}`;
      const orthoStoragePath = `projects/${projectId}/inspections/${inspectionId}/ortho/${finalOrthoName}`;
      await bucket.file(orthoStoragePath).save(annotatedBuffer, { metadata: { contentType: 'image/tiff' }, public: true });

      // Download e Upload do Preview
      const previewBuffer = await imageProcessingService.downloadFile(preview_url);
      const finalPreviewName = `${requestUuid}_preview.jpg`;
      const previewStoragePath = `projects/${projectId}/inspections/${inspectionId}/ortho/${finalPreviewName}`;
      await bucket.file(previewStoragePath).save(previewBuffer, { metadata: { contentType: 'image/jpeg' }, public: true });

      const orthoResult = {
        url: `https://storage.googleapis.com/${bucket.name}/${orthoStoragePath}`,
        previewUrl: `https://storage.googleapis.com/${bucket.name}/${previewStoragePath}`,
        detections: detections.map((d: any) => ({ ...d, id: randomUUID() })),
        originalName: filename,
      };

      await projectService.addOrthoResultsToInspection({ projectId, inspectionId, orthoResults: [orthoResult] });

      console.log(`[ProjectController] Resultados do ortomosaico salvos com sucesso para ${projectId}`);
      return res.status(200).json({ message: 'Callback processado com sucesso.' });
    } catch (error) {
      console.error('[Callback Error]', error);
      return res.status(500).json({ error: 'Falha ao processar callback de ortomosaico.' });
    }
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

    const projectRepository = new ProjectRepository();
    const project = await projectRepository.findById(projectId);
    const inspection = project?.inspections?.find(i => i.id === inspectionId);
    if (!project || !inspection) {
      return res.status(404).json({ error: !project ? 'Projeto não encontrado.' : 'Inspeção não encontrada.' });
    }
    if (isFutureDate(inspection.inspectionDate)) {
      console.log('[ProjectController] Data futura! inspeção agendada');
      return res.status(400).json({ error: 'Data futura! inspeção agendada' });
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
        const { detections, originalFileName } = JSON.parse(jsonContent);

        const fileBuffer = await fs.readFile(tempImagePath);
        const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
        const fileSize = fileBuffer.length;

        const isDuplicate = inspection?.images?.some(img => 
          img.hash === fileHash || 
          img.originalName?.toLowerCase() === originalFileName?.toLowerCase()
        );

        if (isDuplicate) {
          console.log(`[ProjectController] saveReview: ignorando duplicado: ${originalFileName}`);
          await fs.unlink(tempImagePath).catch(() => {});
          await fs.unlink(tempJsonPath).catch(() => {});
          continue;
        }

        const finalFileName = `${imageId}.jpeg`;
        const finalDir = path.resolve(uploadConfig.projectsDirectory, '..', 'processed_images', projectId, inspectionId);
        await fs.mkdir(finalDir, { recursive: true });
        const finalImagePath = path.join(finalDir, finalFileName);
        
        await fs.rename(tempImagePath, finalImagePath);

        const newImage: IImage = {
          url: `/files/processed_images/${projectId}/${inspectionId}/${finalFileName}`,
          detections: detections,
          originalName: originalFileName,
          hash: fileHash,
          size: fileSize,
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

  private getProcessedImageData = async (imagePath: string, imageProcessingService: ImageProcessingService): Promise<{ processedImageBase64: string; detections: IDetection[] }> => {
    try {
      const processedImageResponse = await imageProcessingService.processImage(imagePath);
      return {
        processedImageBase64: processedImageResponse.processed_image_base64,
        detections: processedImageResponse.detections.map((d: any) => ({ ...d, id: randomUUID() })),
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
      coverImageUrl,
      bimModelUrl,
      oaeBimModelUrls,
      buildingYear,
      builtArea,
      facadeTypology,
      roofTypology,
      buildingAcronym,
      unitDirector
    } = req.body;
    
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
        coverImageUrl,
        bimModelUrl,
        oaeBimModelUrls,
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

    const projectRepository = new ProjectRepository();
    const project = await projectRepository.findById(projectId);
    const inspection = project?.inspections?.find(i => i.id === inspectionId);
    if (!project || !inspection) {
      return res.status(404).json({ error: !project ? 'Projeto não encontrado.' : 'Inspeção não encontrada.' });
    }
    if (isFutureDate(inspection.inspectionDate)) {
      console.log('[ProjectController] Data futura! inspeção agendada');
      return res.status(400).json({ error: 'Data futura! inspeção agendada' });
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
