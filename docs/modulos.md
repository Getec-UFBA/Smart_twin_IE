# Guia Arquitetural e Dicionario de Modulos do Sistema
### Smart Twin IE (Smart Inspects) — Manual Tecnico para Desenvolvedores

> **Finalidade deste documento:** Este documento serve como o mapa tecnico definitivo da plataforma Smart Twin IE. Qualquer desenvolvedor, pesquisador ou engenheiro que precise manter, depurar ou adicionar novas funcionalidades encontrara aqui a explicacao detalhada de cada modulo, arquivo e camada do sistema, desde os ambientes de conteinerizacao ate os algoritmos de visao computacional e telas do frontend.

---

## Indice de Conteudo

1. [Visao Geral da Arquitetura e Fluxo de Dados](#1-visao-geral-da-arquitetura-e-fluxo-de-dados)
2. [Ambiente de Desenvolvimento (.devcontainer)](#2-ambiente-de-desenvolvimento-devcontainer)
3. [Microservico de Inteligencia Artificial (ai-service)](#3-microservico-de-inteligencia-artificial-ai-service)
4. [Backend API e Regras de Negocio (backend)](#4-backend-api-e-regras-de-negocio-backend)
5. [Frontend Web React (frontend)](#5-frontend-web-react-frontend)
6. [Scripts de Automacao e Infraestrutura na Raiz](#6-scripts-de-automacao-e-infraestrutura-na-raiz)
7. [Guia Rapido: Onde mexer para cada necessidade](#7-guia-rapido-onde-mexer-para-cada-necessidade)

---

## 1. Visao Geral da Arquitetura e Fluxo de Dados

A plataforma e estruturada em tres servicos independentes e desacoplados que cooperam entre si:

```text
[Cliente Web / Navegador]
       |
       +---> Firebase Hosting (Frontend React)
       |        |
       |        +---> [Chamadas /api/**] ---> Firebase Cloud Functions (Backend Node.js)
       |                                             |
       |                                             +---> Cloud Firestore (Dados e Perfis)
       |                                             +---> Cloud Storage (Fotos, Ortofotos e PDFs)
       |                                             +---> Google Cloud Run (IA / Python FastAPI)
       |                                                      |
       |                                                      +---> Inferência YOLO e GDAL
       |                                                      +---> Gerador de Relatórios (Chromium)
       v
Firebase Auth (Identidade e Tokens JWT)
```

---

## 2. Ambiente de Desenvolvimento (.devcontainer)

Diretorio: [`.devcontainer/`](../.devcontainer)

Garante que qualquer desenvolvedor trabalhe exatamente com as mesmas versoes de SO, bibliotecas compiladas C++, GDAL, Node e Python, eliminando incompatibilidades entre Linux, macOS e Windows.

* [Dockerfile](../.devcontainer/Dockerfile): Imagem base Debian com Node 22, Python 3.11, compiladores C++ (`g++`, `make`), bibliotecas GDAL nativas (`gdal-bin`, `libgdal-dev`), OpenCV e dependencias do Chrome Headless para geracao de relatorios.
* [devcontainer.json](../.devcontainer/devcontainer.json): Mapeamento de portas locais para o VS Code (`5173` para Frontend, `3001` para Backend e `8001` para AI Service), instalacao automatica de extensoes recomendadas (Python, ESLint, Prettier, Docker) e gatilho do script de pos-criacao.
* [post-create.sh](../.devcontainer/post-create.sh): Script executado na criacao do conteiner. Cria o ambiente virtual Python (`venv`), instala as dependencias de `backend/package.json`, `frontend/package.json` e `ai-service/requirements.txt`.

---

## 3. Microservico de Inteligencia Artificial (ai-service)

Diretorio: [`ai-service/`](../ai-service)  
Tecnologias: Python 3, FastAPI, Uvicorn, YOLO (Ultralytics), Rasterio, GDAL, Shapely, OpenCV, Playwright (Chromium).

Responsavel pelo processamento pesado: deteccao de componentes e defeitos em isoladores/estruturas eletricas, fatiamento e georreferenciamento de ortofotos GeoTIFF e renderizacao de relatorios tecnicos em PDF.

### Arquivos do Modulo:

* [main.py](../ai-service/main.py): Ponto de entrada da API FastAPI.
  * `POST /process-image/`: Recebe uma foto isolada (JPG/PNG), executa inferencia rapida com YOLO e devolve as caixas delimitadoras (`bounding boxes`), classes e a imagem anotada em base64.
  * `POST /process-ortho/`: Recebe arquivos GeoTIFF de centenas de megabytes ou gigabytes. Inicia tarefa em segundo plano (`BackgroundTasks`) via `run_ortho_processing_task`, reportando pings de status e notificando o backend via callback HTTP.
  * `POST /generate-pdf`: Recebe o HTML completo do relatorio tecnico montado pelo backend, carrega no Chromium headless atraves do Playwright e devolve o arquivo PDF impresso em formato A4 em alta resolucao.
  * `GET /switch-model/{model_name}`: Permite alternar dinamicamente em tempo de execucao entre o modelo `best` (pesos principais) e `last` (checkpoint secundario).
  * `GET /outputs/{filename}`: Serve arquivos estaticos gerados (GeoTIFFs anotados e previews JPG).

* [ortho_processor.py](../ai-service/ortho_processor.py): Motor geoespacial.
  * Processamento em janelas deslizantes (`sliding window tiles` de 1024x1024 com overlap de 250px) para nao estourar a memoria RAM ao abrir ortofotos gigantes.
  * Conversao de coordenadas de pixels matriciais para coordenadas geograficas (Latitude/Longitude e UTM) preservando metadados EPSG.
  * Agrupamento e resolucao de deteccoes duplicadas na regiao de sobreposicao utilizando a biblioteca geometrica `Shapely`.
  * Gravacao do novo GeoTIFF anotado (`save_annotated_ortho`) e geracao de preview leve para visualizacao web (`generate_preview`).

* [export_model.py](../ai-service/export_model.py): Script utilitario para converter os modelos de treinamento PyTorch (`.pt`) para o formato ONNX (`.onnx`), simplificando e acelerando a execucao na CPU do Cloud Run.

* [models/](../ai-service/models): Pasta contendo os pesos neurais treinados (`best (3).pt`, `last (2).pt`, `best.onnx`).

* [Dockerfile](../ai-service/Dockerfile): Receita de conteiner para producao no Google Cloud Run. Instala o Linux Debian Slim, GDAL, dependencias Python e o Chromium do Playwright com todas as bibliotecas graficas necessarias.

* [requirements.txt](../ai-service/requirements.txt): Lista estrita de pacotes Python necessarios.

---

## 4. Backend API e Regras de Negocio (backend)

Diretorio: [`backend/`](../backend)  
Tecnologias: Node.js, Express, TypeScript, Firebase Admin SDK (Firestore, Storage, Auth), Multer, Axios.

Atua como o cerebro operacional da plataforma: gerencia autenticacao, autorizacoes por papel (RBAC), controle de projetos, inspecoes tecnicas, comunicacao com o servico de IA e composicao de relatorios.

### 4.1. Nucleo do Servidor
* [src/server.ts](../backend/src/server.ts): Inicializa o Express com middlewares de CORS, JSON e rotas. Detecta se esta rodando localmente (porta 3001) ou como Cloud Function V2 no Firebase (`onRequest` com regiao `southamerica-east1` e memoria de 2GiB).

### 4.2. Rotas (`src/routes/`)
* [src/routes/index.ts](../backend/src/routes/index.ts): Concentrador de rotas da API (`/auth`, `/users`, `/profile`, `/projects`). Inclui rota de diagnostico `GET /debug-fb`.
* [src/routes/auth.routes.ts](../backend/src/routes/auth.routes.ts): Rotas de recuperacao e redefinicao de senha (`/forgot-password`, `/reset-password`).
* [src/routes/user.routes.ts](../backend/src/routes/user.routes.ts): Cadastro de usuario (`POST /`), autorizacao de e-mails (`POST /authorize`) e listagem de autorizados (`GET /authorized`).
* [src/routes/profile.routes.ts](../backend/src/routes/profile.routes.ts): Consulta de dados do usuario logado (`GET /me`), atualizacao cadastral (`PUT /me`) e upload de foto de perfil (`PATCH /avatar`).
* [src/routes/project.routes.ts](../backend/src/routes/project.routes.ts): Gerenciamento completo de projetos, criacao e delecao de inspecoes, upload de fotos e ortofotos, callbacks da IA e rota de geracao de PDF (`GET /:projectId/report/pdf/inspections/:inspectionId`).

### 4.3. Controladores (`src/controllers/`)
* [src/controllers/AuthController.ts](../backend/src/controllers/AuthController.ts): Valida entradas e orquestra o fluxo de redefinicao de senha por perguntas de seguranca ou tokens.
* [src/controllers/UserController.ts](../backend/src/controllers/UserController.ts): Trata criacao e autorizacao de usuarios.
* [src/controllers/ProfileController.ts](../backend/src/controllers/ProfileController.ts): Entrega os dados do usuario logado via Admin SDK e gerencia alteracoes de dados pessoais.
* [src/controllers/ProjectController.ts](../backend/src/controllers/ProjectController.ts): Controlador principal com metodos para criar projetos, adicionar inspecoes, processar uploads de imagens para o Cloud Storage, receber webhooks do processador de ortofotos e disparar a geracao do relatorio PDF.

### 4.4. Servicos de Negocio (`src/services/`)
* [src/services/ProjectService.ts](../backend/src/services/ProjectService.ts): Regras de negocio para manipulacao da arvore de dados do projeto (status de progresso, calculo de severidade de patologias, controle de datas).
* [src/services/UserService.ts](../backend/src/services/UserService.ts): Gerencia o ciclo de autorizacao de usuarios. Garante que apenas e-mails aprovados criem conta, sincroniza roles (`admin` ou `user`) na colecao `users` do Firestore e grava Custom Claims no Firebase Auth.
* [src/services/ImageProcessingService.ts](../backend/src/services/ImageProcessingService.ts): Cliente HTTP (Axios) que transmite arquivos enviados pelo usuario para o microservico Python de IA (`PYTHON_SERVICE_URL`).
* [src/services/ReportService.ts](../backend/src/services/ReportService.ts): Monta o layout HTML de relatorios tecnicos de inspecao (tabelas, estatisticas, fotos com deteccoes e logotipo GETEC/UFBA). Transmite o documento compilado para a rota `/generate-pdf` do Cloud Run ou aciona o Puppeteer local em caso de fallback.
* [src/services/AuthService.ts](../backend/src/services/AuthService.ts): Geracao de tokens temporarios, hashing de seguranca e validacao de credenciais complementares.
* [src/services/UpdateProfileService.ts](../backend/src/services/UpdateProfileService.ts) e [src/services/UpdateAvatarService.ts](../backend/src/services/UpdateAvatarService.ts): Atualizam dados e foto de avatar, fazendo upload para o bucket do Cloud Storage e gravando o link publico.

### 4.5. Repositorios e Persistencia (`src/repositories/`)
* [src/repositories/ProjectRepository.ts](../backend/src/repositories/ProjectRepository.ts): Encapsula todas as operacoes na colecao `projects` do Firestore (busca por ID, listagem, criacao, atualizacao e remocao).
* [src/repositories/UserRepository.ts](../backend/src/repositories/UserRepository.ts): Encapsula operacoes na colecao `users` do Firestore (busca por UID, busca por e-mail e persistencia de perfil).

### 4.6. Seguranca e Middlewares (`src/middlewares/`)
* [src/middlewares/auth.ts](../backend/src/middlewares/auth.ts): 
  * `authenticateToken`: Extrai o Bearer token do cabecalho, valida a autenticidade criptografica com o Firebase Admin (`verifyIdToken`), identifica a role do usuario (pelas Claims do token, Firestore ou tabela de autorizados) e anexa `req.userId` e `req.userRole`.
  * `authorizeRole`: Intercepta rotas e bloqueia o acesso com erro 403 caso o papel do usuario nao esteja na lista permitida (ex: rotas exclusivas de administradores).

### 4.7. Modelos de Tipagem (`src/models/`)
* [src/models/IProject.ts](../backend/src/models/IProject.ts): Contrato de dados TypeScript para `IProject`, `IInspection`, `IImage`, `IDetection`, `IOrthoResult`, `IGeoDetection`, `ILibraryFile` e `IPhotogrammetryBatch`.
* [src/models/IUser.ts](../backend/src/models/IUser.ts): Contrato de dados TypeScript para o perfil do usuario (`id`, `email`, `role`, `company`, etc.).

### 4.8. Configuracao (`src/config/`)
* [src/config/firebase.ts](../backend/src/config/firebase.ts): Inicializa o Firebase Admin SDK utilizando as variaveis de ambiente ou segredos do Google Secret Manager.
* [src/config/upload.ts](../backend/src/config/upload.ts): Configura limites de upload de arquivos e pastas temporarias locais via Multer.

---

## 5. Frontend Web React (frontend)

Diretorio: [`frontend/`](../frontend)  
Tecnologias: React 19, TypeScript, Vite, React Router Dom, Bootstrap / CSS Modules, React Icons, Axios, Firebase Web SDK, i18next.

Interface grafica responsiva para engenheiros e inspetores navegarem pelos gemeos digitais, inspecionarem mapas e imagens, gerenciarem usuarios e baixarem relatorios tecnicos.

### 5.1. Ponto de Entrada e Configuracoes Globais
* [src/main.tsx](../frontend/src/main.tsx): Ponto de montagem da aplicacao React no DOM.
* [src/App.tsx](../frontend/src/App.tsx): Declaracao de todas as rotas da aplicacao, encapsuladas pelo `AuthProvider`, `ThemeProvider` e guardas de rota `ProtectedRoute`.
* [src/i18n.ts](../frontend/src/i18n.ts): Configuracao de internacionalizacao com suporte a Portugues (`locales/pt/translation.json`) e Ingles (`locales/en/translation.json`).
* [src/theme.css](../frontend/src/theme.css): Variaveis de cores do sistema de design (suporte completo a Modo Claro e Modo Escuro).
* [src/services/api.ts](../frontend/src/services/api.ts): Instancia configurada do Axios. Detecta automaticamente se esta em desenvolvimento (`http://localhost:3001/api`) ou em producao (`/api` roteado pelo Firebase Hosting) e injeta o token Bearer em todas as requisicoes.
* [src/config/firebase.ts](../frontend/src/config/firebase.ts): Inicializacao do SDK Web do Firebase (`auth`, `db` Firestore e `storage`).

### 5.2. Contextos de Estado Global (`src/contexts/`)
* [src/contexts/AuthContext.tsx](../frontend/src/contexts/AuthContext.tsx): Controla o estado de sessao do usuario (`user`, `token`, `role`). Monitora mudancas de autenticacao via `onAuthStateChanged`, sincroniza com o endpoint `/profile/me` do backend e garante persistencia no `localStorage`.
* [src/contexts/ThemeContext.tsx](../frontend/src/contexts/ThemeContext.tsx): Alterna o tema visual entre claro (`light`) e escuro (`dark`).

### 5.3. Paginas da Aplicacao (`src/pages/`)
* [src/pages/Home/](../frontend/src/pages/Home): Landing page institucional apresentando a proposta do Smart Twin IE, tecnologias e parceiros (GETEC / UFBA).
* [src/pages/Home/](../frontend/src/pages/Home): Landing page institucional apresentando a proposta do Smart Twin IE, tecnologias e parceiros (GETEC / UFBA).
* [src/pages/Login/](../frontend/src/pages/Login): Tela de login com e-mail e senha, validacao de credenciais e link para recuperacao.
* [src/pages/RegisterUser/](../frontend/src/pages/RegisterUser): Tela de auto-cadastro direto para novos usuarios, sem necessidade de autorizacao previa por administrador.
* [src/pages/ForgotPassword/](../frontend/src/pages/ForgotPassword) e [src/pages/ChangePassword/](../frontend/src/pages/ChangePassword): Fluxo de redefinicao de senha com perguntas de seguranca e token.
* [src/pages/AdminDashboard/](../frontend/src/pages/AdminDashboard): Painel de **Usuarios** (`/usuarios`). Permite que todos os usuarios autenticados visualizem os perfis dos demais membros da plataforma e, para administradores (`role === 'admin'`), possibilita a gestao de papeis e acessos.
* [src/pages/Projetos/](../frontend/src/pages/Projetos): Listagem de projetos cadastrados com filtros de busca, criacao de novos projetos e acesso aos detalhes tecnicos e gemeos digitais.
* [src/pages/ProjectView/](../frontend/src/pages/ProjectView): Visualizador principal do gemeo digital 3D. Apresenta o modelo BIM/IFC, mapa interativo com suporte a ortofotos anotadas, camadas Leaflet/OpenStreetMap, marcadores de anomalias detectadas pela IA e upload de novos voos de drone.
* [src/pages/Biblioteca/](../frontend/src/pages/Biblioteca): Acervo documental e historico de edificacoes. Permite criar projetos na Biblioteca informando Ano Construido, Area Quadrada (m²), Tipo Geral, Sistemas (Fachada e Telhado/Cobertura) e Imagem de Capa via upload de arquivo.
* [src/pages/BibliotecaView/](../frontend/src/pages/BibliotecaView): Visualizacao da edificacao na Biblioteca estruturada em 4 pilares: 1. Inspeções (historicas e sincronizadas da aba Projetos em modo somente-leitura); 2. Projetos CAD (.DWG, .DXF, .PDF por disciplina); 3. Modelos BIM (.IFC, .RVT); 4. Levantamentos Fotogrametricos (lotes de voo por data e download de produtos).
* [src/pages/ProjectResults/](../frontend/src/pages/ProjectResults): Painel de indicadores quantitativos, metricas de conformidade, contagem de anomalias e estatisticas da inspecao.
* [src/pages/ReviewImages/](../frontend/src/pages/ReviewImages): Interface de revisao humana onde engenheiros inspecionam as fotos classificadas pelo modelo YOLO, podendo validar ou ajustar deteccoes.
* [src/pages/Profile/](../frontend/src/pages/Profile): Gestao de informacoes cadastrais do usuario e upload de foto de avatar.
* [src/pages/OtherModules/](../frontend/src/pages/OtherModules): Hub para extensao de novos modulos futuros da plataforma.

### 5.4. Componentes Reutilizaveis (`src/components/`)
* [src/components/Layout/](../frontend/src/components/Layout): Estrutura mestre contendo a barra superior (Navbar), botoes de idioma, tema e perfil, envolvendo o conteudo com a Sidebar retratil.
* [src/components/Sidebar/](../frontend/src/components/Sidebar): Barra lateral de navegacao retratil (fechada por padrao). Contem links para Inicio (`/`), Projetos (`/projetos`), Biblioteca (`/biblioteca`) e Usuarios (`/usuarios`). Permanece oculta na tela interna do gemeo digital 3D (`/projetos/:id`) para maximizar o espaco de visualizacao.
* [src/components/ProtectedRoute/](../frontend/src/components/ProtectedRoute): Componente de guarda de rota. Redireciona usuarios nao autenticados para `/login` e valida as permissoes necessarias para rotas restritas.
* [src/components/MaintenanceFeedback/](../frontend/src/components/MaintenanceFeedback): Modal interativo para resolucao e controle de manutencoes em lote em anomalias identificadas.
* [src/components/PasswordInput/](../frontend/src/components/PasswordInput): Campo de entrada de senha reutilizavel com icone de alternancia de visibilidade (mostrar/ocultar senha).
* [src/components/LanguageSwitcher/](../frontend/src/components/LanguageSwitcher) e [src/components/ThemeToggleSwitch/](../frontend/src/components/ThemeToggleSwitch): Controles visuais de selecao de idioma e modo claro/escuro.

---

## 6. Scripts de Automacao e Infraestrutura na Raiz

Diretorio raiz: [`Smart_twin_IE/`](../)

Scripts organizados para facilitar a operacao em desenvolvimento e deploy para a nuvem sem exigir comandos manuais extensos:

* [start.sh](../start.sh) e [start.bat](../start.bat): Inicializacao automatica simultanea do Frontend (5173), Backend (3001) e AI Service (8001) no Linux/macOS e Windows.
* [deploy_ai.sh](../deploy_ai.sh): Script de publicacao do servico de IA e motor de relatorios para o Google Cloud Run (com 8 GiB RAM e 4 vCPUs).
* [deploy_fix.sh](../deploy_fix.sh): Script mestre de publicacao no Firebase. Compila o frontend, sincroniza segredos no Secret Manager e publica o Hosting e as Cloud Functions V2.
* [scale_up_ai.sh](../scale_up_ai.sh): Aumenta instantaneamente os recursos do Cloud Run para 8 GiB de RAM e 4 CPUs para dias de inspecao pesada.
* [scale_down_ai.sh](../scale_down_ai.sh): Reduz os recursos do Cloud Run para 2 GiB de RAM e 1 CPU para economia de faturamento.
* [firebase.json](../firebase.json): Configuracao do Firebase Hosting (roteamento de `/api/**` para as functions e SPA fallback para `/index.html`), Cloud Functions, regras do Firestore e regras do Storage.
* [firestore.rules](../firestore.rules): Regras de seguranca de acesso e leitura/escrita no banco de dados Cloud Firestore.
* [storage.rules](../storage.rules): Regras de seguranca para upload e download de fotos e arquivos no Cloud Storage.

---

## 7. Guia Rapido: Onde mexer para cada necessidade

Se você precisa realizar uma alteracao especifica no sistema, consulte esta tabela para ir direto ao arquivo correto:

| O que você deseja fazer? | Onde você deve mexer? | Arquivos Principais |
| :--- | :--- | :--- |
| **Treinar ou trocar modelo YOLO da IA** | `ai-service/models/` e `ai-service/main.py` | Colocar o arquivo `.pt` em `ai-service/models/` e atualizar `BEST_MODEL_PATH` em `main.py` |
| **Alterar o layout ou cores do Relatorio PDF** | `backend/src/services/ReportService.ts` | Metodo `generateHtmlReport()` (classes CSS, logos, tabelas e ordem das secoes) |
| **Adicionar uma nova tela ou rota no Frontend** | `frontend/src/pages/` e `frontend/src/App.tsx` | Criar a pasta em `pages/` e registrar a rota `<Route>` em `App.tsx` |
| **Alterar itens da barra lateral (Sidebar)** | `frontend/src/components/Sidebar/` | `Sidebar/index.tsx` (adicionar novos links `<Nav.Link>`) |
| **Adicionar um novo endpoint na API Backend** | `backend/src/routes/` e `backend/src/controllers/` | Criar metodo no Controller correspondente e registrar a rota em `routes/` |
| **Ajustar regras de seguranca de acesso (Roles/Admin)** | `backend/src/middlewares/auth.ts` e `backend/src/services/UserService.ts` | `auth.ts` para checagem de rotas e `UserService.ts` para regras de autorizacao |
| **Ajustar variaveis de ambiente e segredos** | `frontend/.env`, `backend/.env` e `docs/hospedagem.md` | Alterar os arquivos locais e rodar `./deploy_fix.sh` para subir segredos |
| **Subir atualizacoes para producao** | Raiz do projeto | Rodar `./deploy_ai.sh` (para IA/relatorio) e `./deploy_fix.sh` (para site/backend) |
