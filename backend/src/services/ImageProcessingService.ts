import axios from 'axios';
import { Readable } from 'stream';
import FormData from 'form-data';

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

  public async processImage(imagePath: string): Promise<IProcessImageResponse> {
    try {
      const formData = new FormData();
      formData.append('file', require('fs').createReadStream(imagePath), {
        filename: require('path').basename(imagePath),
      });

      const response = await axios.post<IProcessImageResponse>(`${this.pythonServiceUrl}/process-image/`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error processing image with Python service:', error);
      throw new Error('Failed to process image with Python service.');
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
