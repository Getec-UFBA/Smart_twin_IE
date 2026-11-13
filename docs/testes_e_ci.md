# Guia de Testes Automatizados e Integração Contínua (CI/CD)

Este documento descreve a estratégia de testes unitários, validação de deploy, integridade Docker e o pipeline de CI via GitHub Actions implementado para a plataforma **Smart Twin IE**.

---

## 1. Visão Geral da Arquitetura de Testes

A suíte de testes do projeto foi projetada para cobrir as funções críticas do sistema em todas as suas camadas:

```text
Smart_twin_IE/
├── backend/
│   └── src/
│       ├── middlewares/__tests__/auth.spec.ts          # Autenticação Firebase & Roles
│       ├── services/__tests__/AuthService.spec.ts      # Validação de tokens de sessão
│       ├── services/__tests__/ProjectService.spec.ts   # Criação, OAEs (BIM), inspeções
│       ├── services/__tests__/ImageProcessingService.spec.ts # Comunicação com IA
│       └── __tests__/deploy-config.spec.ts             # Validação de regras e arquivos de deploy
│
├── frontend/
│   └── src/
│       ├── services/__tests__/api.spec.ts              # Interceptor Axios e injeção Bearer
│       ├── components/ProtectedRoute/__tests__/        # Controle de acesso e rotas privadas
│       └── components/PasswordInput/__tests__/         # Alternância de visibilidade de senha
│
├── ai-service/
│   └── tests/
│       ├── test_ortho_processor.py                     # NMS (IoU) e anotação visual em imagens
│       └── test_api_endpoints.py                       # Rotas FastAPI e alternância de modelo
│
├── scripts/
│   └── test-deploy.sh                                  # Validação de scripts e builds de produção
│
├── run_tests.sh                                        # Script facilitador para execução local
└── .github/workflows/ci.yml                            # Pipeline automatizado no GitHub Actions
```

---

## 2. Como Executar os Testes Localmente

### Script Unificado (`run_tests.sh`)
Para facilitar o desenvolvimento, utilize o script executável na raiz do projeto:

```bash
# Executa todos os testes (Backend, Frontend, AI e Deploy)
./run_tests.sh

# Executar apenas testes do Backend
./run_tests.sh --backend

# Executar apenas testes do Frontend
./run_tests.sh --frontend

# Executar apenas testes do AI Service
./run_tests.sh --ai

# Executar validação de scripts de deploy e builds
./run_tests.sh --deploy

# Testar compilação da imagem Docker do AI Service
./run_tests.sh --docker

# Visualizar todas as opções disponíveis
./run_tests.sh --help
```

---

### Execução Manual por Módulo

#### Backend
O backend utiliza **Vitest** com TypeScript:
```bash
cd backend
npm run test:unit       # Roda os testes unitários
npm test                # Roda typecheck (tsc --noEmit) + testes unitários
```

#### Frontend
O frontend utiliza **Vitest** com `@testing-library/react` e `jsdom`:
```bash
cd frontend
npm test                # Roda os testes unitários dos componentes e serviços
npm run lint            # Executa o ESLint
npm run build           # Valida o build de produção do Vite
```

#### AI Service
O serviço de inteligência artificial utiliza **Pytest**:
```bash
cd ai-service
pip install -r requirements-dev.txt
pytest -v
```

---

## 3. Cobertura das Funções Críticas

### Backend (`backend/`)
* **Autenticação e Permissões (`middlewares/auth.ts` / `AuthService.ts`)**:
  * Bloqueio de requisições sem token (401).
  * Rejeição de tokens expirados ou adulterados (403).
  * Extração e mapeamento de perfis de usuário (`admin` / `user`) via custom claims e fallback no Firestore.
* **Projetos e OAEs (`ProjectService.ts`)**:
  * Criação de projetos e parsing de configurações de módulos.
  * Validação obrigatória da URL do modelo BIM para Obras de Arte Especiais (OAE).
  * Atualização de projetos e criação de inspeções técnicas vinculadas.
* **Orquestração de IA (`ImageProcessingService.ts`)**:
  * Tratamento de falhas de rede e timeouts na comunicação com o microserviço FastAPI.
* **Integridade de Infraestrutura (`deploy-config.spec.ts`)**:
  * Verificação da presença e versão 2 das regras de segurança (`firestore.rules` e `storage.rules`).
  * Validação do `firebase.json` garantindo que os caminhos de build e functions apontam para diretórios corretos.
  * Verificação das diretivas essenciais do `Dockerfile` do `ai-service`.

### Frontend (`frontend/`)
* **Cliente HTTP (`api.ts`)**:
  * Interceptor automático que injeta o token Bearer salvo na sessão em todas as chamadas à API.
* **Segurança de Navegação (`ProtectedRoute.tsx`)**:
  * Exibição de estado de carregamento durante a verificação de sessão.
  * Redirecionamento automático de usuários não logados para `/login`.
  * Liberação de renderização para usuários autorizados.
* **Componentes de Formulário (`PasswordInput.tsx`)**:
  * Alternância dinâmica do tipo de campo (`password` vs `text`) e do ícone de visualização.

### AI Service (`ai-service/`)
* **Processador de Ortomosaicos (`ortho_processor.py`)**:
  * Algoritmo de Supressão Não-Máxima (`_apply_nms`): consolidação de detecções redundantes em áreas de overlap com base no cálculo de IoU (Intersection over Union).
  * Renderização de marcações e bounding boxes sobre matrizes de pixels (`_draw_on_image`).
* **API FastAPI (`main.py`)**:
  * Alternância dinâmica de pesos neurais (`/switch-model/best`, `/switch-model/last`).
  * Validação de campos obrigatórios nas rotas de processamento assíncrono.

---

## 4. Pipeline de CI / GitHub Actions (`.github/workflows/ci.yml`)

O repositório possui uma esteira automatizada configurada para executar a cada `push` e `pull_request` nas branches principais e branches de feature:

| Job | Ambiente | Responsabilidade |
| :--- | :--- | :--- |
| **`backend-ci`** | Node.js 22 | Typecheck (`tsc`), execução dos testes do backend com Vitest e build de produção. |
| **`frontend-ci`** | Node.js 22 | ESLint, execução dos testes com Testing Library e build de produção com Vite. |
| **`ai-service-ci`** | Python 3.11 | Instalação de dependências GDAL/OpenCV e execução dos testes com Pytest. |
| **`deploy-and-docker-ci`** | Ubuntu + Docker | Executa validação de deploy (`./scripts/test-deploy.sh`) e compilação da imagem Docker do AI Service. |

Qualquer falha em testes unitários, erros de tipagem estática, falhas de lint ou quebra no build do Docker bloqueia automaticamente a esteira do Pull Request.
