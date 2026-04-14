import React, { createContext, useState, useContext, useEffect, type ReactNode } from 'react';
import api from '../services/api';

// Interface completa do usuário, espelhando o backend
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
  updateUser(data: IUser): void; // Nova função para atualizar o usuário
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<IUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStoragedData() {
      const storedUser = localStorage.getItem('@gdp:user');
      const storedToken = localStorage.getItem('@gdp:token');

      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      }
      setLoading(false);
    }
    loadStoragedData();
  }, []);

  const login = async (credentials: any) => {
    const response = await api.post('/auth/login', credentials);
    const { user: apiUser, token: apiToken } = response.data;

    setUser(apiUser);
    setToken(apiToken);

    localStorage.setItem('@gdp:user', JSON.stringify(apiUser));
    localStorage.setItem('@gdp:token', apiToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('@gdp:user');
    localStorage.removeItem('@gdp:token');
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
