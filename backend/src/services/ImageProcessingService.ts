import axios from 'axios';
import { Readable } from 'stream';
import FormData from 'form-data';
import sharp from 'sharp';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

interface IDetection {
  class_name: string;
  confidence: number;
  box: { x1: number; y1: number; x2: number; y2: number };
}

interface IProcessImageResponse {
  processed_image_base64: string;
  detections: IDetection[];
}

interface IGeoDetection {
  class_name: string;
  confidence: number;
  pixel_box: { x1: number; y1: number; x2: number; y2: number };
  geo_box: { lat1: number; lon1: number; lat2: number; lon2: number };
  center: { lat: number; lon: number };
}

interface IProcessOrthoResponse {
  filename: string;
  detections_count: number;
  detections: IGeoDetection[];
  preview_base64: string;
  annotated_ortho_url: string;
  preview_url: string;
}

class ImageProcessingService {
  private pythonServiceUrl: string;

  constructor() {
    this.pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';
    if (this.pythonServiceUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
      console.warn('[ImageProcessingService] AVISO: PYTHON_SERVICE_URL parece estar apontando para localhost em produção!');
    }
  }

  public async downloadFile(fileUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(`${this.pythonServiceUrl}${fileUrl}`, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error) {
      console.error(`Error downloading file from ${fileUrl}:`, error);
      throw new Error('Failed to download file from Python service.');
    }
  }

  private async resizeImageIfNeeded(imagePath: string): Promise<string> {
    const optimizedPath = `${imagePath}_optimized.jpg`;
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();

      if (metadata.width && metadata.width > 1600) {
        console.log(`[ImageProcessingService] Redimensionando imagem de ${metadata.width}px para 1600px`);
        await image
          .resize(1600, null, { withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toFile(optimizedPath);
        return optimizedPath;
      }
      
      return imagePath;
    } catch (error) {
      console.error('[ImageProcessingService] Erro ao otimizar imagem:', error);
      return imagePath;
    }
  }

  public async processImage(imagePath: string, retryCount = 0): Promise<IProcessImageResponse> {
    const MAX_RETRIES = 2;
    let currentImagePath = imagePath;
    let isOptimized = false;

    try {
      if (retryCount === 0) {
        const resizedPath = await this.resizeImageIfNeeded(imagePath);
        if (resizedPath !== imagePath) {
          currentImagePath = resizedPath;
          isOptimized = true;
        }
      }

      const formData = new FormData();
      formData.append('file', fsSync.createReadStream(currentImagePath), {
        filename: path.basename(currentImagePath),
      });

      const response = await axios.post<IProcessImageResponse>(`${this.pythonServiceUrl}/process-image/`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 120000,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && (error.response?.status === 503 || error.code === 'ECONNABORTED') && retryCount < MAX_RETRIES) {
        console.warn(`[ImageProcessingService] IA Service instável (Status ${error.response?.status}). Tentativa ${retryCount + 1}/${MAX_RETRIES}...`);
        await new Promise(resolve => setTimeout(resolve, 3000 * (retryCount + 1)));
        return this.processImage(imagePath, retryCount + 1);
      }

      console.error('Error processing image with Python service:', error);
      throw new Error('Failed to process image with Python service.');
    } finally {
      if (isOptimized && currentImagePath !== imagePath) {
        await fs.unlink(currentImagePath).catch(() => {});
      }
    }
  }

  public async processOrtho(orthoPath: string, projectId: string, inspectionId: string, callbackUrl?: string): Promise<{ message: string; request_id: string }> {
    console.log(`[ImageProcessingService] Iniciando envio de ortomosaico para IA: ${path.basename(orthoPath)}`);
    console.log(`[ImageProcessingService] URL da IA: ${this.pythonServiceUrl.substring(0, 20)}...`);
    
    try {
      // Verifica se o arquivo existe e o tamanho
      const stats = await fs.stat(orthoPath);
      console.log(`[ImageProcessingService] Tamanho do arquivo: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);

      const formData = new FormData();
      formData.append('file', fsSync.createReadStream(orthoPath), {
        filename: path.basename(orthoPath),
      });
      formData.append('projectId', projectId);
      formData.append('inspectionId', inspectionId);
      if (callbackUrl) {
        formData.append('callbackUrl', callbackUrl);
        console.log(`[ImageProcessingService] Callback configurado: ${callbackUrl}`);
      }

      // IMPORTANTE: Adicionada a barra '/' final para evitar Redirect 307
      const response = await axios.post(`${this.pythonServiceUrl}/process-ortho/`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 300000, // Aumentado para 5 minutos (apenas para o UPLOAD)
      });

      console.log(`[ImageProcessingService] Resposta da IA: ${response.status} ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('[ImageProcessingService] Erro Axios ao chamar IA:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
          code: error.code
        });
        
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Não foi possível conectar ao serviço de IA. Verifique se a URL está correta.');
        }
        if (error.response?.status === 413) {
          throw new Error('O arquivo do ortomosaico é grande demais para o serviço de IA.');
        }
      }
      
      console.error('Error triggering ortho processing with Python service:', error);
      throw new Error('Failed to trigger orthomosaic processing with Python service.');
    }
  }

  public async switchModel(modelName: 'best' | 'last'): Promise<string> {
    try {
      const response = await axios.get(`${this.pythonServiceUrl}/switch-model/${modelName}`);
      return response.data.message;
    } catch (error) {
      console.error('Error switching model with Python service:', error);
      throw new Error('Failed to switch model with Python service.');
    }
  }
}

export default ImageProcessingService;
