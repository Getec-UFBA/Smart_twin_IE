import axios from 'axios';
import { Readable } from 'stream';
import FormData from 'form-data';
import sharp from 'sharp';
import fs from 'fs/promises';
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

      if (metadata.width && metadata.width > 1600) { // Reduzi um pouco mais para garantir estabilidade
        console.log(`[ImageProcessingService] Redimensionando imagem de ${metadata.width}px para 1600px`);
        await image
          .resize(1600, null, { withoutEnlargement: true })
          .jpeg({ quality: 75 }) // Reduzi qualidade para 75%
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
      formData.append('file', require('fs').createReadStream(currentImagePath), {
        filename: path.basename(currentImagePath),
      });

      const response = await axios.post<IProcessImageResponse>(`${this.pythonServiceUrl}/process-image/`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 120000, // Aumentado para 120 segundos (2 minutos)
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && (error.response?.status === 503 || error.code === 'ECONNABORTED') && retryCount < MAX_RETRIES) {
        console.warn(`[ImageProcessingService] IA Service instável (Status ${error.response?.status}). Tentativa ${retryCount + 1}/${MAX_RETRIES}...`);
        await new Promise(resolve => setTimeout(resolve, 3000 * (retryCount + 1))); // Aumentado o delay entre retentativas
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

  public async processOrtho(orthoPath: string): Promise<IProcessOrthoResponse> {
    try {
      const formData = new FormData();
      formData.append('file', require('fs').createReadStream(orthoPath), {
        filename: require('path').basename(orthoPath),
      });

      const response = await axios.post<IProcessOrthoResponse>(`${this.pythonServiceUrl}/process-ortho/`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 600000, // 10 minutos para ortomosaicos
      });

      return response.data;
    } catch (error) {
      console.error('Error processing ortho with Python service:', error);
      throw new Error('Failed to process orthomosaic with Python service.');
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
