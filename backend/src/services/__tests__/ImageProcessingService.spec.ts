import { describe, it, expect, vi, beforeEach } from 'vitest';
import ImageProcessingService from '../ImageProcessingService';
import axios from 'axios';

vi.mock('axios');

describe('ImageProcessingService', () => {
  let service: ImageProcessingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ImageProcessingService();
  });

  describe('downloadFile', () => {
    it('deve baixar o arquivo do ai-service e retornar um Buffer', async () => {
      const mockData = Buffer.from('mock-image-content');
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockData,
      });

      const result = await service.downloadFile('/outputs/test.jpg');

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/outputs/test.jpg'),
        { responseType: 'arraybuffer' }
      );
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('mock-image-content');
    });

    it('deve lançar erro amigável se a requisição ao ai-service falhar', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Connection refused'));

      await expect(service.downloadFile('/outputs/test.jpg'))
        .rejects.toThrow('Failed to download file from Python service.');
    });
  });
});
