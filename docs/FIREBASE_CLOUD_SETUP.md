# Manual de Infraestrutura, Nuvem e Operações
### Smart Twin IE (Smart Inspects) — Guia do Desenvolvedor e Administrador

> **Finalidade deste documento:** Este manual foi elaborado para qualquer desenvolvedor, pesquisador ou engenheiro de DevOps que assuma a manutenção ou evolução desta plataforma. Ele descreve a arquitetura de nuvem, como provisionar novos ambientes do zero, como gerenciar variáveis e segredos, dimensionamento de hardware (CPU/RAM) e procedimentos operacionais de deploy.

---

## 1. Arquitetura Geral da Plataforma

A plataforma opera no modelo de microsserviços distribuídos entre o **Firebase** e o **Google Cloud Platform (GCP)**:

```text
               +-------------------------------------------------------+
               |                    USUÁRIO FINAL                      |
               +-------------------------------------------------------+
                                           |
                                           v
                       +---------------------------------------+
                       |   Firebase Hosting (Frontend React)   |
                       |       Dist: frontend/dist (Porta 5173)|
                       +---------------------------------------+
                                           |
                    +----------------------+----------------------+
                    | (Requisições /api/**)|                      | (Auth SDK & Leitura de Perfil)
                    v                                             v
     +-------------------------------+              +----------------------------+
     | Cloud Functions Gen 2 (Node)  |              |   Firebase Authentication  |
     | Serviço: api                  |              |   & Firestore Database     |
     | Região: southamerica-east1    |              +----------------------------+
     +-------------------------------+                            |
          |                      |                                |
          | (Salva PDFs,         | (Chama inferência)             | (Salva metadados,
          |  Lê Inspeções)       v                                |  usuários e rotas)
          |           +-------------------------------+           v
          |           | Google Cloud Run (Python IA)  |     +---------------+
          |           | Serviço: ai-service (FastAPI) |     | Cloud Storage |
          |           | Região: us-central1           |     | Bucket Fotos  |
          |           +-------------------------------+     +---------------+
          v                                                       ^
     +------------------------------------------------------------+
```

### Inventário de Serviços

| Componente | Diretório | Tecnologia | Onde Roda | Plano Exigido |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | `frontend/` | React 19 + Vite | Firebase Hosting | Spark (Gratuito) ou Blaze |
| **Backend API** | `backend/` | Node.js + Express | Firebase Cloud Functions V2 | **Blaze (Obrigatório)** |
| **Banco de Dados**| — | Cloud Firestore | GCP / Firebase | Spark ou Blaze |
| **Storage Mídia** | — | Cloud Storage | GCP / Firebase | **Blaze (Obrigatório para criar bucket)** |
| **Autenticação** | — | Firebase Auth | GCP / Firebase | Spark ou Blaze |
| **Serviço de IA** | `ai-service/` | FastAPI + YOLOv8 | Google Cloud Run | **Blaze / GCP Billing (Obrigatório)** |

### Endereços Atuais em Produção

| Componente | Endereço / URL | Hospedagem / Plataforma | Descrição |
| :--- | :--- | :--- | :--- |
| **Aplicação Web (Principal)** | [https://smart-twins-ie.web.app](https://smart-twins-ie.web.app) | Firebase Hosting | Domínio primário do frontend React |
| **Aplicação Web (Alternativa)** | [https://smart-twins-ie.firebaseapp.com](https://smart-twins-ie.firebaseapp.com) | Firebase Hosting | Domínio secundário fornecido pelo Firebase |
| **Backend API (REST)** | `https://smart-twins-ie.web.app/api` | Firebase Cloud Functions V2 | Roteado via rewrite no Hosting para a função `api` (`southamerica-east1`) |
| **Serviço de IA** | `https://ai-service-924973446777.us-central1.run.app` | Google Cloud Run | Microsserviço Python/FastAPI/YOLO (`us-central1`) |

* **ID do Projeto Firebase:** `smart-twins-ie`
* **Bucket do Cloud Storage:** `smart-twins-ie.firebasestorage.app`

---

## 2. Dimensionamento de Hardware (CPU, Memória e Limites Técnicos)

**ATENÇÃO:** O dimensionamento de recursos de computação na nuvem **não deve ser deixado nos valores padrão de fábrica do Google**. Tanto o backend quanto a IA possuem tarefas pesadas com requisitos específicos:

### 2.1. Serviço de IA (`ai-service` no Cloud Run)
Este serviço processa ortofotos GeoTIFF de altíssima resolução com **Rasterio/GDAL** e roda inferência com **PyTorch / YOLOv8**.

* **Memória RAM:** **`4 GiB`** (mínimo indispensável) ou **`8 GiB`** (se as ortofotos ultrapassarem 1 GB de tamanho).
  * *Por que?* O fatiamento da ortofoto em blocos matriciais NumPy consome grande quantidade de RAM volátil. Com 512 MB ou 1 GB, o container sofre **OOM (Out Of Memory)** e cai imediatamente.
* **CPUs / Núcleos:** **`2 vCPUs`** (mínimo) ou **`4 vCPUs`**.
  * *Por que?* A inferência roda em CPU; menos de 2 vCPUs causa lentidão extrema (uma única ortofoto pode demorar mais de 15 minutos).
* **Tempo Limite (Timeout):** **`600 segundos` (10 min)** a **`900 segundos` (15 min)**.
  * *Por que?* O padrão do Cloud Run é 300s (5 min), o que interromperia inspeções longas antes do término.
* **Concorrência Máxima por Instância:** **`1` a `2` (CONFIGURAÇÃO CRÍTICA )**.
  * *Por que?* O padrão do Cloud Run é 80 requisições simultâneas por máquina. Se dois usuários enviarem ortofotos simultaneamente para a mesma máquina, ela estoura a RAM e é reiniciada. Configurar concorrência em `1` força o Google Cloud a criar uma **nova instância isolada** para o segundo usuário.
* **Alocação de CPU:** Selecionar *"Alocar CPU apenas durante o processamento de solicitações"* (economiza custos quando inativo).
* **Instâncias Mínimas/Máximas:** Mínimo `0` (custo zero sem tráfego); Máximo `2` ou `3` (evita surpresas na fatura).

### 2.2. Backend API (`api` nas Cloud Functions V2 / Cloud Run)
Este serviço roda o **Puppeteer (Google Chrome Headless)** para renderizar e compilar relatórios técnicos completos em PDF.

* **Memória RAM:** **`2 GiB`** (definido no código em `backend/src/server.ts`).
  * *Por que?* O Chrome Headless precisa de no mínimo 1.5 a 2 GiB para renderizar documentos HTML com múltiplos gráficos e fotos em alta definição. Menos de 2 GiB faz o processo do Chrome travar com erro de memória.
* **CPUs / Núcleos:** **`1 vCPU`** (automático com 2 GiB) ou **`2 vCPUs`**.
* **Tempo Limite (Timeout):** **`540 segundos` (9 minutos)** — limite máximo para funções HTTP.
* **Região:** **`southamerica-east1`** (São Paulo) — crucial para garantir baixa latência para os clientes no Brasil.

---

## 3. Dicionário de Variáveis de Ambiente e Segredos

### Estrutura de Pastas e Localização dos Arquivos `.env`

A aplicação requer **dois** arquivos `.env` distintos. Cada um deve ser colocado na raiz da sua respectiva pasta:

```text
Smart_twin_IE/
│
├── backend/
│   ├── .env                    <-- [OBRIGATÓRIO] Credenciais confidenciais, Firebase Admin e JWT
│   ├── package.json
│   └── src/
│
├── frontend/
│   ├── .env                    <-- [OBRIGATÓRIO] Credenciais públicas do Firebase Web (Vite)
│   ├── package.json
│   └── src/
│
└── ai-service/                 (não necessita de arquivo .env)
```

### 3.1. Frontend (`frontend/.env`)
Essas variáveis são injetadas no build estático do React (Vite) e são públicas para o navegador do cliente:

| Variável | Descrição | Onde Obter no Firebase Console |
| :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | Chave pública da API Web | Configurações do Projeto > Geral > Seus Aplicativos (Web `</>`) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Domínio de autenticação (`<projeto>.firebaseapp.com`) | Mesmo bloco de configuração |
| `VITE_FIREBASE_PROJECT_ID` | Identificador único do projeto | Mesmo bloco de configuração |
| `VITE_FIREBASE_STORAGE_BUCKET`| Endereço do bucket (`<projeto>.firebasestorage.app`)| Mesmo bloco de configuração |
| `VITE_FIREBASE_MESSAGING_SENDER_ID`| Identificador de envio | Mesmo bloco de configuração |
| `VITE_FIREBASE_APP_ID` | Identificador da aplicação Web | Mesmo bloco de configuração |

### 3.2. Backend (`backend/.env`)
Essas credenciais são **confidenciais** e nunca devem ser enviadas para o Git:

| Variável | Descrição | Onde Obter |
| :--- | :--- | :--- |
| `FIREBASE_PROJECT_ID` | ID do projeto no Firebase | Firebase Console |
| `FIREBASE_CLIENT_EMAIL`| E-mail da Conta de Serviço | Configurações > Contas de serviço > Gerar chave privada (JSON) |
| `FIREBASE_PRIVATE_KEY` | Chave RSA privada completa | Campo `private_key` do arquivo JSON (manter `\n`) |
| `FIREBASE_STORAGE_BUCKET`| Bucket do Cloud Storage | Firebase Console > Storage |
| `JWT_SECRET` | Chave criptográfica para tokens internos | String segura aleatória |
| `PYTHON_SERVICE_URL` | URL do microserviço de IA | Saída do comando `gcloud run deploy ai-service` |

### 3.3. Google Cloud Secret Manager
Em produção, as Cloud Functions não lêem o arquivo `.env` físico. O script `deploy_fix.sh` envia essas variáveis para o **Cloud Secret Manager** do Google Cloud:
* `PROJECT_ID_FB`, `CLIENT_EMAIL_FB`, `PRIVATE_KEY_FB`, `STORAGE_BUCKET_FB`, `JWT_SECRET_FB`, `PYTHON_SERVICE_URL`.

---

## 4. Guia Passo a Passo: Provisionando um Novo Ambiente do Zero

Se a instituição precisar recriar a infraestrutura em uma nova conta Google ou criar um ambiente isolado (ex: Staging/Homologação), siga esta sequência exata:

### Passo 1: Criar o Projeto e Ativar o Plano Blaze
1. Acesse o [Firebase Console](https://console.firebase.google.com/) e clique em **Criar um projeto**.
2. No canto inferior esquerdo, clique em **Fazer upgrade** e vincule uma conta de faturamento (Plano **Blaze**).
   *(Sem o plano Blaze, o Cloud Storage, as Cloud Functions e o Cloud Run não podem ser criados).*

### Passo 2: Ativar o Firebase Authentication
1. Vá em **Criação > Authentication > Primeiros passos**.
2. Na aba **Sign-in method**, ative o provedor **E-mail/senha**.
3. Na aba **Users**, crie o primeiro usuário inserindo seu e-mail e senha.

### Passo 3: Criar o Cloud Firestore e Configurar Regras
1. Vá em **Criação > Firestore Database > Criar banco de dados**.
2. Selecione a edição **Standard** e o **Modo de produção**.
3. Escolha a região (ex: `southamerica-east1`).
4. **Regras de Segurança (Crítico):** Acesse a aba **Regras** (Rules) e publique:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

### Passo 4: Criar o Perfil de Administrador no Firestore
O Smart Twin exige que o usuário exista na coleção `users` com o papel de admin. No console do Firestore:
1. Coleção: `users` -> Criar documento com o **ID sendo o UID do usuário gerado no Auth**:
   - `id`: (string) UID
   - `email`: (string) e-mail do usuário
   - `name`: (string) "Nome Completo"
   - `role`: (string) `"admin"`
   - `company`: (string) "GETEC UFBA"
   - `createdAt`: (timestamp) Data atual
2. Coleção: `authorized_emails` -> Criar documento com o **ID sendo o e-mail em letras minúsculas**:
   - `status`: (string) `"registered"`
   - `role`: (string) `"admin"`
   - `uid`: (string) UID

### Passo 5: Ativar o Cloud Storage
1. Vá em **Criação > Storage > Começar**.
2. Selecione **Modo de produção** e a mesma região do Firestore.
3. Conclua a criação do bucket padrão.

### Passo 6: Obter as Chaves e Preencher os Arquivos Locais
1. Registre o Web App em **Configurações > Geral > Seus aplicativos (`</>`)** e preencha `frontend/.env`.
2. Gere a Conta de Serviço em **Configurações > Contas de serviço > Gerar nova chave privada** e preencha `backend/.env`.
3. Atualize o ID do projeto no arquivo `.firebaserc`.

### Passo 7: O Contêiner da IA (`ai-service`) — Especificação Técnica, Build e Deploy no Google Cloud Run

Para que qualquer desenvolvedor futuro compreenda com exatidão o que está sendo executado:

#### 7.1. O que é e o que contém este Contêiner?
* **Nome do Serviço na Nuvem:** `ai-service`
* **Diretório no repositório:** `ai-service/`
* **Receita Docker:** `ai-service/Dockerfile`
* **Imagem Base do Sistema:** `python:3.9-slim` (Debian Linux minimalista)
* **Pacotes Nativos do Sistema Operacional instalados via `apt-get`:**
  - `gdal-bin` e `libgdal-dev`: Drivers C/C++ da biblioteca geoespacial GDAL, indispensáveis para o Rasterio abrir e ler metadados georreferenciados de ortofotos GeoTIFF de drones.
  - `libgl1` e `libglib2.0-0`: Bibliotecas gráficas necessárias para a renderização de caixas delimitadoras (*bounding boxes*) e marcações pelo OpenCV (`cv2`).
  - `g++`: Compilador C++ necessário para compilar extensões nativas do Python.
* **Bibliotecas Python instaladas (`ai-service/requirements.txt`):**
  - `fastapi` e `uvicorn[standard]`: Servidor web assíncrono de alta performance.
  - `ultralytics`: Framework do modelo de visão computacional **YOLOv8**.
  - `rasterio`: Biblioteca de manipulação de rasters GeoTIFF.
  - `shapely`: Operações geométricas avançadas (união, interseção e desduplicação de anomalias detectadas nas bordas de tiles adjacentes).
  - `opencv-python-headless`: Processamento de imagem e anotação visual.
* **Pesos dos Modelos de IA embutidos na imagem (`ai-service/models/`):**
  - `best (3).pt` (114 MB): Pesos neurais treinados para identificação de defeitos e componentes em isoladores, postes e estruturas elétricas.
  - `last (2).pt` (114 MB): Checkpoint secundário de treinamento.
* **Porta e Execução:** O contêiner inicia com o comando `uvicorn main:app --host 0.0.0.0 --port ${PORT}`, onde a variável `${PORT}` é injetada dinamicamente pelo Cloud Run (padrão local `8001`).
* **Endpoints Principais Expostos:**
  - `POST /predict`: Inferência rápida em fotos únicas JPG/PNG.
  - `POST /process-ortho`: Processamento massivo de ortofotos em janelas (tiles) de 1024x1024 com sobreposição de 250px, agregação via Shapely e exportação de ortomosaico anotado.
  - `GET /outputs/{filename}`: Download dos relatórios e imagens anotadas.

#### 7.2. Por que este serviço PRECISA ser um Contêiner no Cloud Run e não no Cloud Functions?
1. **Tamanho do Pacote:** O Firebase Cloud Functions possui um limite estrito de **500 MB** descompactado. A imagem da IA com PyTorch, YOLO, OpenCV e GDAL pesa aproximadamente **3 a 4 GB**.
2. **Dependências de Sistema:** O Cloud Functions não permite instalar pacotes C++ nativos do Linux (`gdal-dev`, `libgl1`).
3. **Tempo de Processamento:** Ortofotos pesadas exigem até **15 minutos** de computação contínua, enquanto funções HTTP comuns são interrompidas muito antes.

---

#### 7.3. Como Construir e Subir o Contêiner (Passo a Passo 100% Exato)

Existem duas formas exatas de subir este contêiner para o Google Cloud:

##### Método 1: Via Linha de Comando (`gcloud CLI` - 1 Comando Automatizado)
Este método lê a pasta `ai-service/`, envia o código para o **Google Cloud Build**, compila a imagem Docker na nuvem, armazena no **Artifact Registry** e publica diretamente no Cloud Run:

1. Autentique e aponte para o projeto correto:
   ```bash
   gcloud auth login
   gcloud config set project ID-DO-NOVO-PROJETO
   ```
2. Habilite as APIs de computação e build da Google:
   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
   ```
3. Execute o comando de compilação e deploy com as especificações técnicas obrigatórias:
   ```bash
   gcloud run deploy ai-service \
     --source ./ai-service \
     --region us-central1 \
     --allow-unauthenticated \
     --memory 8Gi \
     --cpu 2 \
     --timeout 900 \
     --concurrency 1 \
     --min-instances 0 \
     --max-instances 3 \
     --execution-environment gen2 \
     --project ID-DO-NOVO-PROJETO
   ```

---

##### Método 2: Pela Interface Gráfica (Google Cloud Console)
**Atenção Técnica:** A interface gráfica do Cloud Run **não aceita subir uma pasta de código diretamente pelo navegador**. Ela exige a **URL de uma imagem Docker já construída** no Google Container Registry / Artifact Registry. Portanto, o fluxo exato é:

1. **Etapa A: Construir a imagem Docker via Cloud Build:**
   No terminal, execute o comando que compila o `Dockerfile` e salva a imagem pronta no registro da Google:
   ```bash
   gcloud builds submit ./ai-service --tag gcr.io/ID-DO-NOVO-PROJETO/ai-service:latest --project ID-DO-NOVO-PROJETO
   ```
   *Ao final, ele confirmará o sucesso e gerará a tag:* `gcr.io/ID-DO-NOVO-PROJETO/ai-service:latest`.

2. **Etapa B: Criar o Serviço no Cloud Console:**
   - Acesse: [https://console.cloud.google.com/run](https://console.cloud.google.com/run).
   - Verifique se o projeto selecionado no topo é o correto.
   - Clique em **Criar serviço** (ou clique em `ai-service` > **Editar e implantar nova revisão** se já existir).
   - No campo **URL da imagem do contêiner**, cole:
     `gcr.io/ID-DO-NOVO-PROJETO/ai-service:latest`
   - **Nome do serviço:** `ai-service`
   - **Região:** `us-central1`
   - Na seção **Autenticação**, marque: **Permitir invocações não autenticadas** (para que o backend Node.js possa chamar a API da IA).
   - Abra a aba sanfona **Contêiner, Volumes, Rede, Segurança**:
     - **Capacidade de memória:** Selecione **`8 GiB`**.
     - **CPU:** Selecione **`2 vCPUs`** (ou `4 vCPUs`).
     - **Tempo limite da solicitação (Timeout):** Digite **`900`** segundos.
     - **Simultaneidade máxima (Concorrência):** Digite **`1`** (indispensável para não estourar a RAM se houver duas ortofotos simultâneas).
     - **Mínimo de instâncias:** `0`
     - **Máximo de instâncias:** `3`
     - Na aba **Ambiente de execução**, marque **Ambiente de 2ª geração (Gen 2)**.
   - Clique no botão azul **Criar** (ou **Implantar**).

3. **Etapa C: Conectar a IA ao Backend:**
   Ao concluir o deploy (por qualquer um dos dois métodos), o Cloud Run fornecerá a URL HTTPS pública do serviço (ex: `https://ai-service-xxxx-uc.a.run.app`).
   Copie essa URL e atualize a variável `PYTHON_SERVICE_URL` no arquivo `backend/.env`.



### Passo 8: Deploy do Backend e Frontend (Cloud Functions + Hosting)

**PRÉ-REQUISITO OBRIGATÓRIO:** Antes de disparar o deploy, o terminal **PRECISA** estar autenticado na conta Google que tem acesso de Administrador/Proprietário ao projeto no Firebase:

1. **Faça login na CLI do Firebase:**
   ```bash
   firebase login
   ```
   *Se estiver em um servidor remoto, SSH ou container sem interface gráfica, use:*
   ```bash
   firebase login --no-localhost
   ```
2. **Confirme se o projeto correto está ativo:**
   ```bash
   firebase use default
   ```
   *(Ele deve responder com o ID correto do projeto, ex: `Active project is default (smart-twins-ie)`).*

3. **Execute o script mestre de publicação:**
   ```bash
   chmod +x deploy_fix.sh
   ./deploy_fix.sh
   ```

---

## 5. Ciclo de Vida: Como Fazer Atualizações no Dia a Dia

Para desenvolvedores futuros que alterarem partes específicas do código:

* **Se alterou apenas o Frontend React:**
  ```bash
  cd frontend
  npm run build
  cd ..
  firebase deploy --only hosting
  ```

* **Se alterou apenas a API Node.js (Backend):**
  ```bash
  cd backend
  npm run build
  cd ..
  firebase deploy --only functions
  ```

* **Se alterou o código Python ou modelos YOLO (`ai-service`):**
  ```bash
  gcloud run deploy ai-service \
    --source ./ai-service \
    --region us-central1 \
    --allow-unauthenticated \
    --memory 4Gi \
    --cpu 2 \
    --timeout 600 \
    --concurrency 1 \
    --project ID-DO-PROJETO
  ```

* **Se alterou senhas ou variáveis secretas do Backend:**
  Atualize o `backend/.env` e rode `./deploy_fix.sh` para sincronizar os segredos no Cloud Secret Manager.

---

## 6. Guia de Solução de Problemas (Troubleshooting Runbook)

| Sintoma / Erro | Causa Provável | Ação de Correção |
| :--- | :--- | :--- |
| `FirebaseError: Missing or insufficient permissions` | Regras do Firestore bloqueadas em modo padrão (`if false`). | Publicar regra liberando `allow read, write: if request.auth != null;` na aba Regras do Firestore. |
| Usuário faz login mas não tem acesso ou é deslogado | Falta documento do usuário na coleção `users` com `role: 'admin'`. | Criar o documento na coleção `users` com o UID do usuário no Firestore. |
| Erro 404 ao enviar fotos ou criar projeto | Cloud Storage não foi ativado no Firebase Console. | Acessar a aba Storage no Firebase Console e clicar em "Começar" (requer plano Blaze). |
| Processamento de ortofoto trava ou falha sem erro claro | Container do Cloud Run caiu por falta de memória (OOM). | Aumentar memória da IA para **8 GiB** e garantir que concorrência esteja em **1**. |
| Erro ao gerar relatórios PDF no Backend | Puppeteer excedeu limite de memória na Cloud Function. | Garantir que a Cloud Function `api` esteja configurada com `memory: '2GiB'` no `server.ts`. |
| Deploy do Backend falha dizendo que segredos não existem | Secrets não foram cadastrados no Secret Manager. | Executar o script `./deploy_fix.sh` que faz a injeção automática dos segredos. |
