import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticateToken, authorizeRole, AuthRequest } from '../auth';
import { auth, db } from '../../config/firebase';
import { Response, NextFunction } from 'express';

vi.mock('../../config/firebase', () => ({
  auth: {
    verifyIdToken: vi.fn(),
  },
  db: {
    collection: vi.fn(),
  },
}));

describe('Auth Middleware (authenticateToken & authorizeRole)', () => {
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('deve retornar status 401 se nenhum token for enviado no cabeçalho Authorization', async () => {
    await authenticateToken(req as AuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('deve retornar status 403 se o token for inválido ou expirar', async () => {
    req.headers = { authorization: 'Bearer token-invalido' };
    vi.mocked(auth.verifyIdToken).mockRejectedValueOnce(new Error('Firebase ID token has expired.'));

    await authenticateToken(req as AuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('deve autenticar com sucesso e extrair a role dos claims do token', async () => {
    req.headers = { authorization: 'Bearer valid-admin-token' };
    vi.mocked(auth.verifyIdToken).mockResolvedValueOnce({
      uid: 'user-admin-123',
      role: 'admin',
    } as any);

    await authenticateToken(req as AuthRequest, res as Response, next);

    expect(req.userId).toBe('user-admin-123');
    expect(req.userRole).toBe('admin');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('deve buscar a role no Firestore (collection users) se ausente nos claims', async () => {
    req.headers = { authorization: 'Bearer valid-user-token' };
    vi.mocked(auth.verifyIdToken).mockResolvedValueOnce({
      uid: 'user-456',
    } as any);

    const mockGetDoc = vi.fn().mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'admin' }),
    });
    vi.mocked(db.collection).mockReturnValueOnce({
      doc: vi.fn().mockReturnValue({ get: mockGetDoc }),
    } as any);

    await authenticateToken(req as AuthRequest, res as Response, next);

    expect(req.userId).toBe('user-456');
    expect(req.userRole).toBe('admin');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('deve atribuir role user como fallback padrão', async () => {
    req.headers = { authorization: 'Bearer standard-token' };
    vi.mocked(auth.verifyIdToken).mockResolvedValueOnce({
      uid: 'user-789',
    } as any);

    const mockGetDoc = vi.fn().mockResolvedValueOnce({
      exists: false,
    });
    vi.mocked(db.collection).mockReturnValueOnce({
      doc: vi.fn().mockReturnValue({ get: mockGetDoc }),
    } as any);

    await authenticateToken(req as AuthRequest, res as Response, next);

    expect(req.userId).toBe('user-789');
    expect(req.userRole).toBe('user');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('authorizeRole deve permitir a continuidade da requisição', () => {
    const middleware = authorizeRole(['admin']);
    middleware(req as AuthRequest, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
