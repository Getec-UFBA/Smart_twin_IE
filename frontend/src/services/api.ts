import axios from 'axios';

// Detecta se estamos rodando localmente (Vite dev server) ou em produção
const isDevelopment = import.meta.env.MODE === 'development';

// No Firebase, as requisições para /api são redirecionadas para as Functions.
// Localmente, apontamos direto para a porta 3001 do backend standalone.
const API_URL = isDevelopment ? 'http://localhost:3001' : '/api';

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor para garantir que o token mais recente do localStorage seja usado,
// caso não tenha sido injetado pelo AuthContext.
api.interceptors.request.use(async config => {
  const token = localStorage.getItem('@gdp:token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const isAxiosError = axios.isAxiosError;
export default api;
