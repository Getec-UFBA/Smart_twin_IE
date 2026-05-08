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
    return key
      .replace(/^"(.*)"$/, '$1') // Remove aspas duplas externas
      .replace(/^'(.*)'$/, '$1') // Remove aspas simples externas
      .replace(/\\n/g, '\n');    // Converte \n literal em quebras de linha REAIS
  };

  const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY || process.env.FB_PRIVATE_KEY);
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.FB_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FB_CLIENT_EMAIL;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.FB_STORAGE_BUCKET,
  });
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const auth = admin.auth();
const storage = admin.storage();

export { db, auth, storage, admin };
