# Especificacao e Contrato da API REST
### Smart Twin IE (Smart Inspects) — Referencia de Endpoints

> **Finalidade deste documento:** Este manual documenta todos os endpoints da API REST disponibilizados pelo Backend Node.js e pelo Microservico de Inteligencia Artificial (FastAPI). Serve como contrato de integracao para o frontend web, futuros aplicativos moveis e integracoes externas.

---

## Indice

1. [Padroes Globais e Autenticacao](#1-padroes-globais-e-autenticacao)
2. [Enderecos Base (Base URLs)](#2-enderecos-base-base-urls)
3. [Modulo de Usuarios e Acesso (/users)](#3-modulo-de-usuarios-e-acesso-users)
4. [Modulo de Perfil do Usuario (/profile)](#4-modulo-de-perfil-do-usuario-profile)
5. [Modulo de Recuperacao de Senha (/auth)](#5-modulo-de-recuperacao-de-senha-auth)
6. [Modulo de Projetos e Inspecoes (/projects)](#6-modulo-de-projetos-e-inspecoes-projects)
7. [Modulo de Revisao Humana e Inferencia](#7-modulo-de-revisao-humana-e-inferencia)
8. [Endpoints do Servico de IA (ai-service)](#8-endpoints-do-servico-de-ia-ai-service)

---

## 1. Padroes Globais e Autenticacao

### Formato de Cabecalho para Rotas Protegidas
A maioria das rotas exige um token de autenticacao emitido pelo Firebase Auth no cabecalho HTTP:

```http
Authorization: Bearer <ID_TOKEN_DO_FIREBASE>
Content-Type: application/json
```

### Niveis de Acesso (RBAC)
* **Publico:** Nao exige cabecalho de autenticacao.
* **Autenticado (`admin`, `user`):** Exige token valido de qualquer usuario registrado.
* **Exclusivo Admin (`admin`):** O token precisa pertencer a um usuario com `role: "admin"` no Firestore/Claims. Retorna `403 Forbidden` se for usuario comum.

### Respostas de Erro Padronizadas
```json
{
  "error": "Descricao do erro ocorrido."
}
```
ou
```json
{
  "message": "Descricao da falha na validacao."
}
```

---

## 2. Enderecos Base (Base URLs)

| Ambiente | Backend API (Node.js) | Servico de IA (Python FastAPI) |
| :--- | :--- | :--- |
| **Desenvolvimento Local** | `http://localhost:3001/api` | `http://localhost:8001` |
| **Producao (Nuvem)** | `https://smart-twins-ie.web.app/api` | `https://ai-service-924973446777.us-central1.run.app` |

---

## 3. Modulo de Usuarios e Acesso (/users)

Arquivo responsavel: [`backend/src/controllers/UserController.ts`](../backend/src/controllers/UserController.ts)

### 3.1. Finalizar Cadastro de Usuario
* **Metodo / Rota:** `POST /users`
* **Permissao:** Publico (chamado logo apos o usuario criar a conta no Firebase Auth).
* **Descricao:** Registra o perfil do usuario no Firestore em `users/{uid}`. Nao exige pre-autorizacao previa (auto-cadastro liberado). Caso o e-mail conste previamente na tabela `authorized_emails`, sua `role` predefinida e aplicada; caso contrario, assume `role: 'user'` por padrao.
* **Corpo da Requisicao:**
  ```json
  {
    "id": "cM65TfRPhJN8LjGSbtxI6bdgFPj1",
    "email": "engenheiro@empresa.com",
    "name": "Nome Completo",
    "company": "Nome da Empresa",
    "role": "user"
  }
  ```
* **Resposta de Sucesso (201 Created):** Retorna o objeto do usuario salvo.
* **Resposta de Erro (400 Bad Request):** `"Erro ao registrar usuário."`

### 3.2. Listar Todos os Usuarios da Plataforma
* **Metodo / Rota:** `GET /users`
* **Permissao:** Autenticado (qualquer usuario autenticado pode visualizar todos os perfis cadastrados no Painel de Usuarios `/usuarios`).
* **Descricao:** Retorna a relacao de todos os usuarios cadastrados com nome, empresa, e-mail, papel e avatar.
* **Resposta de Sucesso (200 OK):**
  ```json
  [
    {
      "id": "cM65TfRPhJN8LjGSbtxI6bdgFPj1",
      "name": "Matheus Rafael",
      "email": "matheus@ufba.br",
      "role": "admin",
      "company": "GETEC UFBA",
      "avatarUrl": "https://..."
    }
  ]
  ```

### 3.3. Obter Perfil de Usuario por ID
* **Metodo / Rota:** `GET /users/:id`
* **Permissao:** Autenticado.
* **Descricao:** Retorna os dados publicos do perfil de um usuario especifico.

### 3.4. Autorizar Novo E-mail (Pre-cadastro e Promocao)
* **Metodo / Rota:** `POST /users/authorize`
* **Permissao:** Autenticado / Admin.
* **Descricao:** Grava a permissao na colecao `authorized_emails`. Se o usuario ja existir, atualiza imediatamente seu papel no Firestore e nas Custom Claims do Firebase Auth.
* **Corpo da Requisicao:**
  ```json
  {
    "email": "novo.engenheiro@empresa.com",
    "role": "admin"
  }
  ```
* **Resposta de Sucesso (200 OK):**
  ```json
  {
    "message": "E-mail autorizado com sucesso."
  }
  ```

### 3.5. Listar E-mails Autorizados
* **Metodo / Rota:** `GET /users/authorized`
* **Permissao:** Autenticado.
* **Descricao:** Retorna a lista de todos os e-mails liberados, pendentes ou ja cadastrados na tabela de controle.

---

## 4. Modulo de Perfil do Usuario (/profile)

Arquivo responsavel: [`backend/src/controllers/ProfileController.ts`](../backend/src/controllers/ProfileController.ts)

### 4.1. Consultar Perfil Atual
* **Metodo / Rota:** `GET /profile/me`
* **Permissao:** Autenticado.
* **Descricao:** Retorna os dados cadastrais do usuario autenticado pelo token JWT, sem expor informacoes sensiveis.
* **Resposta de Sucesso (200 OK):**
  ```json
  {
    "id": "cM65TfRPhJN8LjGSbtxI6bdgFPj1",
    "email": "engenheiro@empresa.com",
    "name": "Nome Completo",
    "role": "admin",
    "company": "GETEC UFBA",
    "avatarUrl": "https://firebasestorage.googleapis.com/.../avatar.jpg"
  }
  ```

### 4.2. Atualizar Dados Cadastrais
* **Metodo / Rota:** `PUT /profile/me`
* **Permissao:** Autenticado.
* **Corpo da Requisicao:**
  ```json
  {
    "name": "Novo Nome",
    "company": "Nova Empresa",
    "bio": "Engenheiro Eletricista responsavel"
  }
  ```

### 4.3. Upload de Avatar / Foto de Perfil
* **Metodo / Rota:** `PATCH /profile/avatar`
* **Permissao:** Autenticado.
* **Tipo:** `multipart/form-data` (campo `avatar`).
* **Descricao:** Faz upload da imagem para o Cloud Storage e salva o link publico no perfil.

---

## 5. Modulo de Recuperacao de Senha (/auth)

Arquivo responsavel: [`backend/src/controllers/AuthController.ts`](../backend/src/controllers/AuthController.ts)

* `POST /auth/forgot-password`: Recebe `{"email": "..."}`, verifica pergunta de seguranca cadastrada ou envia link de recuperacao.
* `POST /auth/reset-password`: Recebe `{"token": "...", "newPassword": "..."}` para consolidar nova credencial.

---

## 6. Modulo de Projetos e Inspecoes (/projects)

Arquivo responsavel: [`backend/src/controllers/ProjectController.ts`](../backend/src/controllers/ProjectController.ts)

### 6.1. Listar Projetos
* **Metodo / Rota:** `GET /projects`
* **Permissao:** Autenticado.
* **Descricao:** Retorna todos os projetos visiveis.

### 6.2. Criar Novo Projeto / Edificacao
* **Metodo / Rota:** `POST /projects`
* **Permissao:** Exclusivo Admin.
* **Corpo da Requisicao:**
  ```json
  {
    "name": "Pavilhao de Aulas Glauber Rocha",
    "address": "Campus Ondina - Salvador, BA",
    "type": "Edificacao Educacional",
    "responsible": "Eng. Matheus Rafael",
    "buildingYear": "2015",
    "builtArea": "3200",
    "facadeTypology": "Pintura Acrilica sobre Argamassa",
    "roofTypology": "Telha Metalica Termoacustica",
    "buildingAcronym": "PAF-III",
    "unitDirector": "Prof. Coordenador",
    "coverImageUrl": "https://firebasestorage.googleapis.com/.../capa.jpg",
    "onlyLibrary": false,
    "modules": {
      "progress": true,
      "security": true,
      "maintenance": true
    }
  }
  ```
  > **Nota sobre a Imagem de Capa:** A foto de capa (`coverImageUrl`) e opcional. Ao criar a edificacao pelo modal da Biblioteca ou de Projetos, o usuario pode selecionar um arquivo local que e enviado ao Cloud Storage, ou manter sem capa (o sistema exibe uma capa padrao).
  > **Nota sobre `onlyLibrary`:** Quando enviado como `true` (criacao feita na Biblioteca), a edificacao nao sera listada na pagina de Projetos (`/projetos`), garantindo o fluxo unidirecional.

### 6.3. Detalhes de um Projeto
* **Metodo / Rota:** `GET /projects/:id`
* **Permissao:** Autenticado.
* **Descricao:** Retorna o objeto integral do projeto incluindo todas as inspecoes, fotos, ortofotos anotadas, patologias, acervo CAD, modelos BIM e lotes fotogrametricos.

### 6.4. Criar Inspecao em um Projeto
* **Metodo / Rota:** `POST /projects/:projectId/inspections`
* **Permissao:** Exclusivo Admin.
* **Corpo da Requisicao:**
  ```json
  {
    "inspectionType": "Voo de Drone com Termografia",
    "inspectionObjective": "Mapeamento termografico de paineis e isoladores",
    "inspectionDate": "2026-09-20",
    "inspectionResponsible": "Eng. Responsavel",
    "isPast": false
  }
  ```
  > `isPast`: Quando `true`, indica que a inspecao foi criada diretamente na **Biblioteca** como acervo historico documental (habilita upload livre de fotos sem disparar inferencia YOLO nem plano de acao). Quando `false` ou omitido, refere-se a uma inspecao orientada a gemeo digital criada no modulo de Projetos.

### 6.5. Atualizar Manutencao de Deteccoes / Patologias
* **Metodo / Rota:** `PATCH /projects/:projectId/inspections/:inspectionId/detections`
* **Permissao:** Autenticado.
* **Descricao:** Atualiza em lote o status de correcao de patologias identificadas pela IA.
* **Corpo da Requisicao:**
  ```json
  {
    "detectionIds": ["det_001", "det_002"],
    "status": "resolved",
    "maintenanceResponsible": "Equipe de Campo",
    "maintenanceNotes": "Isolador substituto instalado conforme norma.",
    "maintenanceCost": 450.00
  }
  ```

### 6.6. Download de Relatorio Tecnico em PDF
* **Metodo / Rota:** `GET /projects/:projectId/report/pdf/inspections/:inspectionId`
* **Permissao:** Autenticado.
* **Descricao:** Compila o documento oficial de inspecao tecnica utilizando o motor Chromium e devolve o fluxo binario em formato PDF.
* **Resposta de Sucesso (200 OK):**
  * `Content-Type: application/pdf`
  * `Content-Disposition: attachment; filename=relatorio-inspecao-<id>.pdf`

---

### 6.7. Endpoints da Biblioteca Tecnica e Acervo Documental

Modulo responsavel: [`backend/src/controllers/ProjectController.ts`](../backend/src/controllers/ProjectController.ts#L828-L934)

#### 6.7.1. Upload de Imagens em Inspecao da Biblioteca
* **Metodo / Rota:** `POST /projects/:projectId/inspections/:inspectionId/images`
* **Permissao:** Autenticado.
* **Descricao:** Salva uma lista de fotos no array `images` de uma inspecao (utilizado na Biblioteca para fotos historicas com `isPast: true`). Inspecoes originarias de Projetos (`!isPast`) sao tratadas como somente leitura na Biblioteca para preservar a integridade das deteccoes do gemeo digital.
* **Corpo da Requisicao:**
  ```json
  {
    "images": [
      {
        "url": "https://firebasestorage.googleapis.com/.../foto1.jpg",
        "originalName": "foto1.jpg",
        "size": 2048576
      }
    ]
  }
  ```

#### 6.7.2. Gerenciamento de Projetos CAD
* **Adicionar Arquivo CAD:** `POST /projects/:projectId/library/cad`
  * Corpo: `{ "file": { "id": "...", "name": "Planta.dwg", "url": "https://...", "size": 1024, "uploadedAt": "..." } }`
* **Excluir Arquivo CAD:** `DELETE /projects/:projectId/library/cad/:fileId`

#### 6.7.3. Gerenciamento de Modelos BIM
* **Adicionar Modelo BIM:** `POST /projects/:projectId/library/bim`
  * Corpo: `{ "file": { "id": "...", "name": "Estrutura.ifc", "url": "https://...", "size": 5242880, "uploadedAt": "..." } }`
* **Excluir Modelo BIM:** `DELETE /projects/:projectId/library/bim/:fileId`

#### 6.7.4. Gerenciamento de Levantamentos Fotogrametricos
* **Criar Lote Fotogrametrico por Data:** `POST /projects/:projectId/library/photogrammetry`
  * Corpo: `{ "batch": { "id": "...", "date": "2026-08-15", "title": "Campanha Norte", "description": "...", "files": [] } }`
* **Adicionar Arquivos a Lote Existente:** `POST /projects/:projectId/library/photogrammetry/:batchId/files`
  * Corpo: `{ "files": [ { "id": "...", "name": "nuvem.las", "url": "https://...", "size": 10485760, "uploadedAt": "..." } ] }`
* **Excluir Lote Fotogrametrico Inteiro:** `DELETE /projects/:projectId/library/photogrammetry/:batchId`
* **Excluir Arquivo Especifico de um Lote:** `DELETE /projects/:projectId/library/photogrammetry/:batchId/files/:fileId`

---

## 7. Modulo de Revisao Humana e Inferencia

### 7.1. Processar Lote de Imagens para Revisao
* **Metodo / Rota:** `POST /projects/process-images`
* **Permissao:** Autenticado.
* **Tipo:** `multipart/form-data`.
* **Descricao:** Envia fotos brutas para deteccao preliminar do YOLO e retorna um `reviewId` para inspecao visual na tela de revisao.

### 7.2. Processar Ortomosaico GeoTIFF
* **Metodo / Rota:** `POST /projects/process-ortho`
* **Permissao:** Autenticado.
* **Tipo:** `multipart/form-data` (arquivo `.tif` ou `.tiff`).
* **Descricao:** Transmite o GeoTIFF bruto para o servico de IA iniciar o fatiamento matricial em background.

### 7.3. Confirmar e Salvar Revisao Humana
* **Metodo / Rota:** `POST /projects/review/:reviewId/save`
* **Permissao:** Autenticado.
* **Descricao:** Valida as fotos confirmadas pelo engenheiro e consolida permanentemente na inspecao dentro do Firestore.

---

## 8. Endpoints do Servico de IA (ai-service)

Arquivo responsavel: [`ai-service/main.py`](../ai-service/main.py)

### 8.1. Inferencia Rapida em Imagem Unica
* **Metodo / Rota:** `POST /process-image/`
* **Tipo:** `multipart/form-data` (campo `file`).
* **Resposta:**
  ```json
  {
    "processed_image_base64": "/9j/4AAQSkZJRg...",
    "detections": [
      {
        "class_name": "isolador_polimerico",
        "confidence": 0.94,
        "box": { "x1": 120.5, "y1": 45.2, "x2": 260.1, "y2": 190.4 }
      }
    ]
  }
  ```

### 8.2. Fatiamento e Analise Geoespacial de Ortofoto
* **Metodo / Rota:** `POST /process-ortho/`
* **Tipo:** `multipart/form-data`
  * `file`: Arquivo GeoTIFF.
  * `projectId`: Identificador do projeto.
  * `inspectionId`: Identificador da inspecao.
  * `callbackUrl`: URL do backend para receber o webhook ao concluir (`https://.../api/projects/ortho-callback`).
* **Resposta Imediata (202 Accepted):**
  ```json
  {
    "message": "Processamento iniciado."
  }
  ```

### 8.3. Geracao de Relatorio PDF em Alta Resolucao
* **Metodo / Rota:** `POST /generate-pdf`
* **Tipo:** `application/json`
* **Corpo da Requisicao:**
  ```json
  {
    "html": "<!DOCTYPE html><html><head>...</head><body>...</body></html>"
  }
  ```
* **Resposta de Sucesso (200 OK):**
  * `Content-Type: application/pdf`
  * Stream binario do arquivo PDF A4 gerado com Playwright e Chromium headless nativo.

### 8.4. Alternar Modelo Neural Ativo
* **Metodo / Rota:** `GET /switch-model/{model_name}`
* **Parametros de URL:** `model_name` = `'best'` ou `'last'`.
* **Resposta:** `{"message": "Switched to 'best'."}`
