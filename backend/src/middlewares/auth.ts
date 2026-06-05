import { Request, Response, NextFunction } from 'express';
import { auth, db } from '../config/firebase';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: 'admin' | 'user';
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.userId = decodedToken.uid;
    
    // Busca a role no Firestore
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    
    if (userDoc.exists) {
      req.userRole = userDoc.data()?.role || 'user';
    } else {
      console.warn(`Perfil Firestore não encontrado para UID: ${decodedToken.uid}. Usando role padrão 'user'.`);
      req.userRole = 'user';
    }
    
    next();
  } catch (error) {
    console.error('Erro na validação do Token Firebase:', error);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

export const authorizeRole = (roles: Array<'admin' | 'user'>) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.userRole && roles.includes(req.userRole)) {
      return next();
    }
    console.error(`Acesso Negado: Usuário ${req.userId} tem role '${req.userRole}' mas as rotas exigem: ${roles}`);
    return res.status(403).json({ message: 'Access denied' });
  };
};
