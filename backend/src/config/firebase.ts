import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

// Carrega variáveis do .env - Tenta múltiplos caminhos para compatibilidade local e nuvem
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config(); // Fallback padrão

if (!admin.apps.length) {
  // Função para limpar e formatar a chave privada vinda do .env ou Secrets
  const formatPrivateKey = (key?: string) => {
    if (!key) return undefined;
    
    // Se a chave vier do Secrets via stdin (pode conter outras variáveis se setada via arquivo)
    if (key.includes('FIREBASE_PRIVATE_KEY=')) {
      const match = key.match(/FIREBASE_PRIVATE_KEY="?([^"\n]+)"?/);
      if (match) key = match[1];
    }

    return key
      .replace(/^"(.*)"$/, '$1') // Remove aspas duplas externas
      .replace(/^'(.*)'$/, '$1') // Remove aspas simples externas
      .replace(/\\n/g, '\n');    // Converte \n literal em quebras de linha REAIS
  };

  // Prioridade para segredos do Firebase (_FB) e depois env padrão
  const privateKey = formatPrivateKey(process.env.PRIVATE_KEY_FB || process.env.FIREBASE_PRIVATE_KEY || process.env.FB_PRIVATE_KEY);
  const projectId = process.env.PROJECT_ID_FB || process.env.FIREBASE_PROJECT_ID || process.env.FB_PROJECT_ID;
  const clientEmail = process.env.CLIENT_EMAIL_FB || process.env.FIREBASE_CLIENT_EMAIL || process.env.FB_CLIENT_EMAIL;

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket: process.env.STORAGE_BUCKET_FB || process.env.FIREBASE_STORAGE_BUCKET || process.env.FB_STORAGE_BUCKET,
    });
  } else {
    console.warn('Firebase Admin not initialized: missing credentials. (Expected during build/analysis if .env is missing)');
  }
}

const db = admin.apps.length ? admin.firestore() : null!;
if (db) db.settings({ ignoreUndefinedProperties: true });

const auth = admin.apps.length ? admin.auth() : null!;
const storage = admin.apps.length ? admin.storage() : null!;

export { db, auth, storage, admin };
