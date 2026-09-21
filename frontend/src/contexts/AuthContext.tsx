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
          const tokenResult = await firebaseUser.getIdTokenResult(true);
          const idToken = tokenResult.token;
          const claimRole = tokenResult.claims.role as 'admin' | 'user' | undefined;
          setToken(idToken);
          
          // Configura o token no Axios IMEDIATAMENTE
          api.defaults.headers.Authorization = `Bearer ${idToken}`;
          
          let loadedUser: IUser | null = null;

          // 1. Tenta buscar o perfil completo via Backend API (/profile/me com Admin SDK)
          try {
            const profileRes = await api.get('/profile/me');
            if (profileRes.data && profileRes.data.role) {
              loadedUser = profileRes.data as IUser;
            }
          } catch (apiErr) {
            console.warn("API /profile/me indisponível no momento, usando fallback Firestore:", apiErr);
          }

          // 2. Se a API não respondeu, busca diretamente no Firestore pelo SDK Web
          if (!loadedUser) {
            try {
              const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
              if (userDoc.exists()) {
                loadedUser = { id: firebaseUser.uid, ...userDoc.data() } as IUser;
              }
            } catch (fsErr) {
              console.warn("Erro ao buscar no Firestore pelo cliente:", fsErr);
            }
          }

          // 3. Aplica o usuário com a role identificada (prioriza claim do token se houver)
          if (loadedUser) {
            if (claimRole && loadedUser.role !== claimRole) {
              loadedUser.role = claimRole;
            }
            setUser(loadedUser);
            localStorage.setItem('@gdp:user', JSON.stringify(loadedUser));
          } else {
            const basicUser: IUser = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: claimRole || 'user'
            };
            setUser(basicUser);
            localStorage.setItem('@gdp:user', JSON.stringify(basicUser));
          }
        } catch (error) {
          console.error("Erro ao processar autenticação:", error);
          await firebaseSignOut(auth);
        }
      } else {
        setUser(null);
        setToken(null);
        delete api.defaults.headers.Authorization;
        localStorage.clear(); // Limpa dados locais
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async ({ email, password }: any) => {
    const cleanEmail = (email || '').trim();
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const tokenResult = await userCredential.user.getIdTokenResult(true);
    const idToken = tokenResult.token;
    const claimRole = tokenResult.claims.role as 'admin' | 'user' | undefined;
    
    setToken(idToken);
    api.defaults.headers.Authorization = `Bearer ${idToken}`;

    // Imediatamente tenta carregar os dados do usuário para evitar atraso de estado na navegação
    try {
      const profileRes = await api.get('/profile/me');
      if (profileRes.data) {
        const userData = profileRes.data as IUser;
        if (claimRole) userData.role = claimRole;
        setUser(userData);
        localStorage.setItem('@gdp:user', JSON.stringify(userData));
        return;
      }
    } catch (e) {
      // Fallback para Firestore
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (userDoc.exists()) {
        const userData = { id: userCredential.user.uid, ...userDoc.data() } as IUser;
        if (claimRole) userData.role = claimRole;
        setUser(userData);
        localStorage.setItem('@gdp:user', JSON.stringify(userData));
      }
    }
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
