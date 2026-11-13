import { describe, it, expect, beforeEach } from 'vitest';
import api from '../api';

describe('Frontend API Service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('deve ter baseURL definida para a API', () => {
    expect(api.defaults.baseURL).toBeDefined();
  });

  it('deve anexar o header Authorization se o token existir no localStorage', async () => {
    localStorage.setItem('@gdp:token', 'jwt-token-123');

    const requestHandler = (api.interceptors.request as any).handlers[0].fulfilled;
    const config = { headers: {} as Record<string, string> };
    const modifiedConfig = await requestHandler(config);

    expect(modifiedConfig.headers.Authorization).toBe('Bearer jwt-token-123');
  });

  it('não deve alterar o header Authorization se nenhum token estiver no localStorage', async () => {
    const requestHandler = (api.interceptors.request as any).handlers[0].fulfilled;
    const config = { headers: {} as Record<string, string> };
    const modifiedConfig = await requestHandler(config);

    expect(modifiedConfig.headers.Authorization).toBeUndefined();
  });
});
