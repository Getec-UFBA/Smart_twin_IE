import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import cors from 'cors';
import routes from './routes';
import path from 'path';

const app = express();

app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// Servir arquivos estáticos da pasta 'public' (Compatibilidade)
app.use('/files', express.static(path.resolve(__dirname, '..', 'public', 'uploads')));

app.use(routes);

// --- CONFIGURAÇÃO DE DEPLOY (FIREBASE FUNCTIONS V2) ---
export const api = onRequest({
  timeoutSeconds: 540,
  memory: '1GiB',
  region: 'southamerica-east1'
}, app);

// --- MODO DE DESENVOLVIMENTO LOCAL ---
// Só inicia o servidor se não estivermos em um ambiente de nuvem ou ferramentas do Firebase
const isFirebaseEnv = !!(
  process.env.FUNCTION_NAME || 
  process.env.K_SERVICE || 
  process.env.FUNCTIONS_EMULATOR || 
  process.env.FIREBASE_CONFIG ||
  process.env.VITE_FIREBASE_API_KEY // Variável comum no seu ambiente que indica estar em processo de ferramentas
);

if (!isFirebaseEnv) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Standalone server started on port ${PORT}!`);
  });
}
