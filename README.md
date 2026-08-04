# Smart Twin IE Platform (Smart Inspects)

Plataforma web para visualização, análise e gerenciamento de inspeções técnicas e gêmeos digitais de infraestrutura elétrica. O sistema integra um **frontend React (Vite)**, um **backend Node.js (Express/Firebase)** e um **serviço de Inteligência Artificial (FastAPI/YOLO)** em Python para detecção de anomalias e análise geoespacial de ortofotos.

---

## 🏗️ Arquitetura do Sistema

O projeto é dividido em três serviços principais dispostos no repositório:

1. **`frontend/` (React + Vite)**: Interface do usuário para mapas interativos, exibição de gêmeos digitais, relatórios e gestão de inspeções. (Porta `5173`)
2. **`backend/` (Node.js + Express + TypeScript)**: API central, autenticação, gerenciamento de relatórios (Puppeteer PDF), integração com o Firebase Firestore e Storage. (Porta `3001`)
3. **`ai-service/` (Python + FastAPI + YOLOv8)**: Microserviço de visão computacional e análise geoespacial para identificação de componentes, defeitos e processamento de ortofotos GeoTIFF. (Porta `8001`)

---

## 🔒 Configuração das Variáveis de Ambiente (`.env`)

Antes de iniciar a aplicação, verifique se os arquivos `.env` existem em suas respectivas pastas e se contêm as credenciais necessárias configuradas:

### 1. Backend (`backend/.env`)
Certifique-se de que o arquivo `backend/.env` existe e contém as seguintes variáveis de ambiente:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `JWT_SECRET`
- `PYTHON_SERVICE_URL`
- `PORT`

### 2. Frontend (`frontend/.env`)
Certifique-se de que o arquivo `frontend/.env` existe e contém as seguintes variáveis de ambiente:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

---

## 📁 Estrutura de Diretórios

```text
Smart_twin_IE/
├── .devcontainer/        # Configuração do ambiente isolado de desenvolvimento (Docker)
│   ├── Dockerfile        # Imagem base com Python 3.11, Node 22, GDAL, OpenCV e Puppeteer
│   ├── devcontainer.json # Mapeamento de portas e extensões do VS Code
│   └── post-create.sh    # Instalação automática de dependências no container
├── frontend/             # Aplicação Web em React + Vite + TypeScript (Porta 5173)
│   ├── src/              # Componentes, páginas, serviços e contexto
│   └── vite.config.ts    # Configurações do Vite e servidor local
├── backend/              # API REST em Node.js + Express + TypeScript (Porta 3001)
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

## 🚀 Como Executar o Projeto

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
   - 🌐 **Frontend (React)**: [http://localhost:5173](http://localhost:5173)
   - ⚡ **Backend API**: [http://localhost:3001](http://localhost:3001)
   - 🤖 **AI Service**: [http://localhost:8001](http://localhost:8001)

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

## 🚀 Deploy no Firebase (Cloud Functions + Hosting)

Para atualizar o deploy em ambiente de produção (Firebase Cloud Functions para o backend e Firebase Hosting para o frontend React):

```bash
chmod +x deploy_fix.sh
./deploy_fix.sh
```

---

## 📋 Resumo das Portas e Serviços

| Serviço | Diretório | Tecnologia | Porta |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | `frontend/` | React 19 + Vite | `5173` |
| **Backend API** | `backend/` | Node.js + Express + Firebase Admin | `3001` |
| **AI Service** | `ai-service/` | Python + FastAPI + YOLOv8 + GDAL | `8001` |
