# Smart Twin IE Platform (Smart Inspects)

Plataforma web para visualização, análise e gerenciamento de inspeções técnicas e gêmeos digitais de infraestrutura elétrica. O sistema integra um **frontend React (Vite)**, um **backend Node.js (Express/Firebase)** e um **serviço de Inteligência Artificial (FastAPI/YOLO)** em Python para detecção de anomalias e análise geoespacial de ortofotos.

---

## Arquitetura do Sistema

O projeto é dividido em três serviços principais dispostos no repositório:

1. **`frontend/` (React + Vite)**: Interface do usuário para mapas interativos, exibição de gêmeos digitais, relatórios e gestão de inspeções. (Porta `5173`)
2. **`backend/` (Node.js + Express + TypeScript)**: API central, autenticação, gerenciamento de relatórios (Puppeteer PDF), integração com o Firebase Firestore e Storage. (Porta `3001`)
3. **`ai-service/` (Python + FastAPI + YOLO)**: Microserviço de visão computacional e análise geoespacial para identificação de componentes, defeitos e processamento de ortofotos GeoTIFF. (Porta `8001`)

---

## Configuração das Variáveis de Ambiente (`.env`)

A aplicação necessita de **dois arquivos `.env` separados** (um dentro da pasta `backend/` e outro dentro da pasta `frontend/`). O serviço `ai-service/` não necessita de arquivo `.env`.

### Onde criar os arquivos `.env`:

```text
Smart_twin_IE/
│
├── backend/
│   ├── .env                    <-- [CRIAR AQUI] Variáveis da API e credenciais do Firebase Admin
│   └── ...
│
├── frontend/
│   ├── .env                    <-- [CRIAR AQUI] Credenciais públicas do Firebase Web App
│   └── ...
│
└── ai-service/                 (não requer arquivo .env)
```

### 1. Backend (`backend/.env`)
Crie o arquivo em `backend/.env` com as seguintes chaves:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `JWT_SECRET`
- `PYTHON_SERVICE_URL`
- `PORT`

### 2. Frontend (`frontend/.env`)
Crie o arquivo em `frontend/.env` com as seguintes chaves:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

---

## Estrutura de Diretórios

```text
Smart_twin_IE/
├── .devcontainer/        # Configuração do ambiente isolado de desenvolvimento (Docker)
│   ├── Dockerfile        # Imagem base com Python 3.11, Node 22, GDAL, OpenCV e Puppeteer
│   ├── devcontainer.json # Mapeamento de portas e extensões do VS Code
│   └── post-create.sh    # Instalação automática de dependências no container
├── frontend/             # Aplicação Web em React + Vite + TypeScript (Porta 5173)
│   ├── .env              # [OBRIGATÓRIO] Variáveis do Firebase Web (Vite)
│   ├── src/              # Componentes, páginas, serviços e contexto
│   └── vite.config.ts    # Configurações do Vite e servidor local
├── backend/              # API REST em Node.js + Express + TypeScript (Porta 3001)
│   ├── .env              # [OBRIGATÓRIO] Chaves secretas, Firebase Admin e JWT
│   ├── src/              # Rotas, controladores, serviços Firebase e PDF
│   └── public/           # Arquivos estáticos e modelos de relatório
├── ai-service/           # Microserviço de Inteligência Artificial em Python (Porta 8001)
│   ├── main.py           # API FastAPI e rotas de inferência
│   ├── ortho_processor.py# Processamento geoespacial de ortofotos (GDAL/Rasterio)
│   ├── models/           # Modelos de detecção YOLO (.pt)
│   └── requirements.txt  # Dependências Python
├── start.sh              # Script de inicialização unificada para Linux/macOS/DevContainer
├── start.bat             # Script de inicialização unificada para Windows
└── deploy_fix.sh         # Script automatizado de deploy no Firebase (Functions + Hosting)
```

---

## Como Executar o Projeto

### Opção A: Utilizando DevContainer (Recomendado)

O projeto possui um ambiente pré-configurado via **Dev Containers (VS Code + Docker)** que instala automaticamente todas as dependências do sistema operacional (GDAL, C++, OpenCV, Puppeteer) e pacotes Node.js e Python.

1. Instale o **Docker** e a extensão **Dev Containers** no VS Code.
2. Abra a pasta do projeto no VS Code.
3. Pressione `F1` e escolha **Dev Containers: Reopen in Container**.
4. Aguarde a construção do container e a execução automática do script de pós-criação.
5. No terminal integrado do VS Code, execute:
   ```bash
   ./start.sh
   ```
6. Acesse os serviços localmente:
   - **Frontend (React)**: [http://localhost:5173](http://localhost:5173)
   - **Backend API**: [http://localhost:3001](http://localhost:3001)
   - **AI Service**: [http://localhost:8001](http://localhost:8001)

---

### Opção B: Instalação Manual (Sem Docker)

#### Pré-requisitos
- **Node.js**: v20 ou v22 LTS
- **Python**: v3.10 ou v3.11
- **GDAL e ferramentas C++**: Necessários no SO para compilação geoespacial.

#### 1. Instalar Dependências

No Linux / macOS:
```bash
bash .devcontainer/post-create.sh
```

No Windows (CMD / PowerShell):
```cmd
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
cd ai-service && python -m venv venv && .\venv\Scripts\activate && pip install -r requirements.txt && cd ..
```

#### 2. Iniciar Todos os Serviços

No Linux / macOS / DevContainer:
```bash
./start.sh
```

No Windows:
```cmd
start.bat
```

---

## Sequencia de Deploy para Producao

Ao atualizar a plataforma ou subir novas melhorias:

### 1. Primeiro: Deploy do Servico de IA e Relatorios (Cloud Run)
Publica o microservico de Inteligencia Artificial e o motor Chromium de geracao de relatorios PDF:

```bash
chmod +x deploy_ai.sh
./deploy_ai.sh
```

### 2. Segundo: Deploy da Aplicacao e Backend (Firebase)
Compila o frontend React, envia os segredos atualizados e publica a API (Cloud Functions) que chama o servico de IA:

```bash
chmod +x deploy_fix.sh
./deploy_fix.sh
```

---

## Manuais e Documentacoes Tecnicas (`docs/`)

A pasta [`docs/`](docs/) reune guias detalhados para administradores, desenvolvedores e pesquisadores:

1. **[`docs/modulos.md`](docs/modulos.md):** Mapa arquitetural detalhado de cada modulo do sistema (`.devcontainer`, `ai-service`, `backend`, `frontend`, scripts e matriz de consulta rapida).
2. **[`docs/hospedagem.md`](docs/hospedagem.md):** Manual de infraestrutura, provisionamento do zero, deploy no Firebase/Cloud Run, escalonamento dinamico de hardware e resolucao de problemas.
3. **[`docs/api.md`](docs/api.md):** Contrato completo de todos os endpoints REST (Backend e IA), parametros de requisicao, cabecalhos de autenticacao e respostas JSON.
4. **[`docs/fluxo_inspecao.md`](docs/fluxo_inspecao.md):** Ciclo de vida ponta a ponta da inspecao (upload do drone, fatiamento matricial com IA, georreferenciamento GDAL, revisao humana e relatorio PDF).
5. **[`docs/banco_de_dados.md`](docs/banco_de_dados.md):** Dicionario de dados e modelagem NoSQL do Cloud Firestore (`projects`, `users`, `authorized_emails`), regras de seguranca e estrategia de backup.

---

## Endereços de Produção (Hospedagem)

| Componente | Endereço / URL | Plataforma | Observações |
| :--- | :--- | :--- | :--- |
| **Aplicação Web (Principal)** | [https://smart-twins-ie.web.app](https://smart-twins-ie.web.app) | Firebase Hosting | Domínio padrão de produção |
| **Aplicação Web (Alternativa)** | [https://smart-twins-ie.firebaseapp.com](https://smart-twins-ie.firebaseapp.com) | Firebase Hosting | Domínio secundário do Firebase |
| **Backend API (REST)** | `https://smart-twins-ie.web.app/api` | Firebase Cloud Functions V2 | Roteado via rewrite no Firebase Hosting (`southamerica-east1`) |
| **Serviço de IA** | `https://ai-service-924973446777.us-central1.run.app` | Google Cloud Run | Microsserviço de inferência YOLO e ortofotos |

* **Projeto Firebase:** `smart-twins-ie`

---

## Resumo das Portas e Serviços

| Serviço | Diretório | Tecnologia | Porta |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | `frontend/` | React 19 + Vite | `5173` |
| **Backend API** | `backend/` | Node.js + Express + Firebase Admin | `3001` |
| **AI Service** | `ai-service/` | Python + FastAPI + YOLOv8 + GDAL | `8001` |
