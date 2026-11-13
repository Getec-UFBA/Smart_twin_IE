import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Deploy Configuration & Artifacts Integrity', () => {
  const rootDir = path.resolve(__dirname, '../../../');

  describe('firebase.json & Security Rules', () => {
    it('deve existir um arquivo firebase.json válido', () => {
      const firebaseConfigPath = path.join(rootDir, 'firebase.json');
      expect(fs.existsSync(firebaseConfigPath)).toBe(true);

      const content = fs.readFileSync(firebaseConfigPath, 'utf-8');
      const json = JSON.parse(content);

      expect(json.hosting).toBeDefined();
      expect(json.hosting.public).toBe('frontend/dist');
      expect(json.functions).toBeDefined();
      expect(json.functions.source).toBe('backend');
    });

    it('as regras do Firestore (firestore.rules) devem existir e conter rules_version 2', () => {
      const rulesPath = path.join(rootDir, 'firestore.rules');
      expect(fs.existsSync(rulesPath)).toBe(true);

      const content = fs.readFileSync(rulesPath, 'utf-8');
      expect(content).toContain("rules_version = '2';");
      expect(content).toContain('service cloud.firestore');
    });

    it('as regras do Storage (storage.rules) devem existir e conter rules_version 2', () => {
      const rulesPath = path.join(rootDir, 'storage.rules');
      expect(fs.existsSync(rulesPath)).toBe(true);

      const content = fs.readFileSync(rulesPath, 'utf-8');
      expect(content).toContain("rules_version = '2';");
      expect(content).toContain('service firebase.storage');
    });
  });

  describe('Docker Configuration (AI Service)', () => {
    it('deve existir um Dockerfile válido no ai-service com requisitos essenciais', () => {
      const dockerfilePath = path.join(rootDir, 'ai-service/Dockerfile');
      expect(fs.existsSync(dockerfilePath)).toBe(true);

      const content = fs.readFileSync(dockerfilePath, 'utf-8');
      expect(content).toMatch(/^FROM python:/m);
      expect(content).toContain('COPY requirements.txt');
      expect(content).toContain('uvicorn');
    });

    it('deve existir o arquivo .dockerignore no ai-service para otimizar o build', () => {
      const dockerignorePath = path.join(rootDir, 'ai-service/.dockerignore');
      expect(fs.existsSync(dockerignorePath)).toBe(true);
    });
  });

  describe('Deploy Shell Scripts', () => {
    it('os scripts de deploy devem existir no diretório raiz', () => {
      const deployAi = path.join(rootDir, 'deploy_ai.sh');
      const deployFix = path.join(rootDir, 'deploy_fix.sh');

      expect(fs.existsSync(deployAi)).toBe(true);
      expect(fs.existsSync(deployFix)).toBe(true);
    });
  });
});
