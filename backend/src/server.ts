import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import cors from 'cors';
import routes from './routes';
import path from 'path';

const app = express();

app.use(cors());

// LOG DE REQUISIÇÕES
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Type: ${req.headers['content-type']}`);
  next();
});

// IMPORTANTE: Em Firebase Functions, NÃO use parsers globais se for lidar com arquivos pesados.
// Vamos deixar para cada rota decidir como ler o corpo.
app.use((req, res, next) => {
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    // Pula parsers para uploads
    return next();
  }
  express.json({ limit: '100mb' })(req, res, next);
});

app.use((req, res, next) => {
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    // Pula parsers para uploads
    return next();
  }
  express.urlencoded({ extended: true, limit: '100mb' })(req, res, next);
});

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ error: `Rota ${req.method} ${req.path} não encontrada.` });
});

// --- CONFIGURAÇÃO DE DEPLOY (FIREBASE FUNCTIONS V2) ---
export const api = onRequest({
  timeoutSeconds: 540,
  memory: '2GiB',
  region: 'southamerica-east1',
  secrets: ['PROJECT_ID_FB', 'CLIENT_EMAIL_FB', 'PRIVATE_KEY_FB', 'STORAGE_BUCKET_FB', 'JWT_SECRET_FB', 'PYTHON_SERVICE_URL']
}, app);

// --- MODO DE DESENVOLVIMENTO LOCAL ---
// Se estivermos em produção ou no ambiente do Firebase, não rodamos o listen()
const isFirebase = !!(process.env.K_SERVICE || process.env.FUNCTION_NAME || process.env.FIREBASE_CONFIG || process.env.FUNCTIONS_EMULATOR);

if (!isFirebase) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Standalone Server started on port ${PORT}!`);
  });
}
