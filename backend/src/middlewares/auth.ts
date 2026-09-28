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
    
    // 1. Verifica se a role já veio nos custom claims do token
    let role = (decodedToken as any).role as 'admin' | 'user' | undefined;
    
    // 2. Se não estiver no token, busca no Firestore collection 'users'
    if (!role) {
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      if (userDoc.exists) {
        role = userDoc.data()?.role;
      }
    }

    // 3. Fallback: se ainda não achou, checa em 'authorized_emails' pelo email do token
    if (!role && decodedToken.email) {
      const authEmailDoc = await db.collection('authorized_emails').doc(decodedToken.email.toLowerCase().trim()).get();
      if (authEmailDoc.exists) {
        role = authEmailDoc.data()?.role;
        // Já sincroniza no documento do usuário no Firestore
        await db.collection('users').doc(decodedToken.uid).set({
          email: decodedToken.email.toLowerCase().trim(),
          role: role || 'user',
        }, { merge: true });
      }
    }
    
    req.userRole = role || 'user';
    
    next();
  } catch (error) {
    console.error('Erro na validação do Token Firebase:', error);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

export const authorizeRole = (_roles: Array<'admin' | 'user'>) => {
  return (_req: AuthRequest, _res: Response, next: NextFunction) => {
    // Branch sem controle de acesso: qualquer usuário autenticado pode acessar
    return next();
  };
};
