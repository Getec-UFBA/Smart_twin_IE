import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuthService from '../AuthService';
import { auth } from '../../config/firebase';
import UserRepository from '../../repositories/UserRepository';

vi.mock('../../config/firebase', () => ({
  auth: {
    verifyIdToken: vi.fn(),
  },
  db: {
    collection: vi.fn(),
  },
}));

vi.mock('../../repositories/UserRepository');

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService();
  });

  it('deve verificar o token e retornar os dados do usuário com sucesso', async () => {
    const mockUser = {
      id: 'uid-123',
      name: 'Engenheiro Teste',
      email: 'teste@exemplo.com',
      role: 'admin' as const,
    };

    vi.mocked(auth.verifyIdToken).mockResolvedValueOnce({
      uid: 'uid-123',
    } as any);

    vi.mocked(UserRepository.prototype.findById).mockResolvedValueOnce(mockUser as any);

    const result = await authService.verifyToken({ idToken: 'valid-firebase-jwt' });

    expect(auth.verifyIdToken).toHaveBeenCalledWith('valid-firebase-jwt');
    expect(UserRepository.prototype.findById).toHaveBeenCalledWith('uid-123');
    expect(result).toEqual({ user: mockUser });
  });

  it('deve lançar erro caso o perfil do usuário não seja encontrado no repositório', async () => {
    vi.mocked(auth.verifyIdToken).mockResolvedValueOnce({
      uid: 'uid-inexistente',
    } as any);

    vi.mocked(UserRepository.prototype.findById).mockResolvedValueOnce(undefined);

    await expect(authService.verifyToken({ idToken: 'valid-jwt-but-no-profile' }))
      .rejects.toThrow('Token inválido ou expirado.');
  });

  it('deve lançar erro se verifyIdToken falhar', async () => {
    vi.mocked(auth.verifyIdToken).mockRejectedValueOnce(new Error('Invalid token'));

    await expect(authService.verifyToken({ idToken: 'bad-token' }))
      .rejects.toThrow('Token inválido ou expirado.');
  });
});
