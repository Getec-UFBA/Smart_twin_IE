import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProjectService from '../ProjectService';
import ProjectRepository from '../../repositories/ProjectRepository';

vi.mock('../../config/firebase', () => ({
  storage: {
    bucket: vi.fn().mockReturnValue({
      file: vi.fn().mockReturnValue({
        save: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        makePublic: vi.fn().mockResolvedValue(undefined),
        publicUrl: vi.fn().mockReturnValue('https://storage.googleapis.com/test-bucket/test-file.jpg'),
      }),
    }),
  },
  db: {
    collection: vi.fn(),
  },
}));

vi.mock('../../repositories/ProjectRepository');

describe('ProjectService', () => {
  let projectService: ProjectService;

  beforeEach(() => {
    vi.clearAllMocks();
    projectService = new ProjectService();
  });

  describe('create', () => {
    it('deve criar um projeto com sucesso com módulos padrão', async () => {
      const mockProjectPayload = {
        userId: 'user-1',
        name: 'Edifício Central',
        address: 'Av. Paulista, 1000',
        type: 'Predial',
        responsible: 'Carlos Engenheiro',
      };

      vi.mocked(ProjectRepository.prototype.create).mockImplementation(async (project) => project);

      const result = await projectService.create(mockProjectPayload);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Edifício Central');
      expect(result.modules).toEqual({ progress: true, security: true, maintenance: true });
      expect(ProjectRepository.prototype.create).toHaveBeenCalledTimes(1);
    });

    it('deve processar módulos passados como string JSON', async () => {
      const mockProjectPayload = {
        userId: 'user-1',
        name: 'Ponte Estaiada',
        address: 'Marginal Pinheiros',
        type: 'Infraestrutura',
        responsible: 'Ana Engenheira',
        modules: JSON.stringify({ progress: false, security: true, maintenance: false }),
      };

      vi.mocked(ProjectRepository.prototype.create).mockImplementation(async (project) => project);

      const result = await projectService.create(mockProjectPayload);

      expect(result.modules).toEqual({ progress: false, security: true, maintenance: false });
    });

    it('deve lançar erro se OAE for informada sem a respectiva URL do modelo BIM', async () => {
      const mockProjectPayload = {
        userId: 'user-1',
        name: 'Viaduto do Chá',
        address: 'Centro Histórico',
        type: 'Infraestrutura',
        responsible: 'Marcos Silva',
        oaeData: JSON.stringify([{ name: 'Pilar 1' }]),
        oaeBimModelUrls: [], // Sem URL para a OAE
      };

      await expect(projectService.create(mockProjectPayload))
        .rejects.toThrow('URL do modelo BIM não encontrada para a OAE: Pilar 1');
    });

    it('deve mapear corretamente OAEs quando bimModelUrl for fornecida', async () => {
      const mockProjectPayload = {
        userId: 'user-1',
        name: 'Viaduto do Chá',
        address: 'Centro Histórico',
        type: 'Infraestrutura',
        responsible: 'Marcos Silva',
        oaeData: [{ name: 'Pilar 1' }],
        oaeBimModelUrls: ['https://storage.googleapis.com/bim/pilar1.glb'],
      };

      vi.mocked(ProjectRepository.prototype.create).mockImplementation(async (project) => project);

      const result = await projectService.create(mockProjectPayload);

      expect(result.oae).toBeDefined();
      expect(result.oae?.length).toBe(1);
      expect(result.oae?.[0].bimModelUrl).toBe('https://storage.googleapis.com/bim/pilar1.glb');
    });
  });

  describe('update', () => {
    it('deve atualizar o projeto com sucesso', async () => {
      const existingProject = {
        id: 'proj-123',
        userId: 'user-1',
        name: 'Projeto Original',
        address: 'Rua A',
        type: 'Predial',
        responsible: 'Engenheiro',
      };

      const updatedData = { name: 'Projeto Nome Atualizado' };

      vi.mocked(ProjectRepository.prototype.findById).mockResolvedValueOnce(existingProject as any);
      vi.mocked(ProjectRepository.prototype.update).mockResolvedValueOnce({
        ...existingProject,
        ...updatedData,
      } as any);

      const result = await projectService.update({ projectId: 'proj-123', data: updatedData });

      expect(result.name).toBe('Projeto Nome Atualizado');
      expect(ProjectRepository.prototype.update).toHaveBeenCalledWith('proj-123', updatedData);
    });

    it('deve lançar erro quando o projeto a atualizar não for encontrado', async () => {
      vi.mocked(ProjectRepository.prototype.findById).mockResolvedValueOnce(undefined);

      await expect(projectService.update({ projectId: 'proj-inexistente', data: {} }))
        .rejects.toThrow('Projeto não encontrado.');
    });
  });

  describe('createInspection', () => {
    it('deve criar uma inspeção com sucesso vinculada ao projeto', async () => {
      const existingProject = {
        id: 'proj-123',
        userId: 'user-1',
        name: 'Edifício Principal',
        address: 'Rua Central',
        type: 'Predial',
        responsible: 'Engenheiro Chefe',
        inspections: [],
      };

      vi.mocked(ProjectRepository.prototype.findById).mockResolvedValueOnce(existingProject as any);
      vi.mocked(ProjectRepository.prototype.update).mockImplementation(async (_id, data) => ({
        ...existingProject,
        ...data,
      } as any));

      const inspection = await projectService.createInspection({
        projectId: 'proj-123',
        inspectionType: 'Rotina',
        inspectionObjective: 'Verificação periódica',
        inspectionDate: '2026-11-12',
        inspectionResponsible: 'Engenheiro Fiscal',
      });

      expect(inspection).toHaveProperty('id');
      expect(inspection.inspectionType).toBe('Rotina');
      expect(inspection.inspectionObjective).toBe('Verificação periódica');
      expect(ProjectRepository.prototype.update).toHaveBeenCalledTimes(1);
    });
  });
});
