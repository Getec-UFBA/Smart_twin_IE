import React, { createContext, useState, useContext, useEffect, type ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import api from '../services/api';

// Interface completa do usuário
interface IUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
  name?: string;
  company?: string;
  bio?: string;
  avatarUrl?: string;
}

interface AuthContextData {
  user: IUser | null;
  token: string | null;
  loading: boolean;
  login(credentials: any): Promise<void>;
  logout(): void;
  updateUser(data: IUser): void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<IUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Monitora o estado de autenticação do Firebase
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true);
      if (firebaseUser) {
        try {
          // Força a obtenção de um token novo e válido
          const idToken = await firebaseUser.getIdToken(true);
          setToken(idToken);
          
          // Configura o token no Axios IMEDIATAMENTE
          api.defaults.headers.Authorization = `Bearer ${idToken}`;
          
          // Busca dados adicionais do usuário no Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            const userData = { id: firebaseUser.uid, ...userDoc.data() } as IUser;
            setUser(userData);
            localStorage.setItem('@gdp:user', JSON.stringify(userData));
          } else {
            const basicUser: IUser = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: 'user'
            };
            setUser(basicUser);
          }
        } catch (error) {
          console.error("Erro ao processar login:", error);
          await firebaseSignOut(auth);
        }
      } else {
        setUser(null);
        setToken(null);
        delete api.defaults.headers.Authorization;
        localStorage.clear(); // Limpa TUDO para evitar conflitos com versões antigas
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async ({ email, password }: any) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    
    setToken(idToken);
    api.defaults.headers.Authorization = `Bearer ${idToken}`;
  };

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  const updateUser = (data: IUser) => {
    setUser(data);
    localStorage.setItem('@gdp:user', JSON.stringify(data));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextData {
  const context = useContext(AuthContext);
  return context;
}
