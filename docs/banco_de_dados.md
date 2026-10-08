# Dicionario de Dados e Esquema do Cloud Firestore
### Smart Twin IE (Smart Inspects) — Modelagem NoSQL

> **Finalidade deste documento:** Como o Google Cloud Firestore e um banco de dados NoSQL orientado a documentos e sem esquema rigido (schemaless), este documento serve como a referencia oficial de modelagem de dados, descrevendo todas as colecoes, documentos, campos, tipagens e regras de integridade do sistema.

---

## Indice

1. [Visao Geral das Colecoes](#1-visao-geral-das-colecoes)
2. [Colecao: users (Perfis de Usuarios)](#2-colecao-users-perfis-de-usuarios)
3. [Colecao: authorized_emails (Controle de Acesso e Pre-cadastro)](#3-colecao-authorized_emails-controle-de-acesso-e-pre-cadastro)
4. [Colecao: projects (Projetos, Inspecoes e Gemeos Digitais)](#4-colecao-projects-projetos-inspecoes-e-gemeos-digitais)
5. [Regras de Seguranca (firestore.rules)](#5-regras-de-seguranca-firestorerules)
6. [Estrategia de Backup e Exportacao](#6-estrategia-de-backup-e-exportacao)

---

## 1. Visao Geral das Colecoes

A arquitetura de dados do Smart Twin IE utiliza tres colecoes de primeiro nivel:

```text
Cloud Firestore
│
├── users/                [ID do Doc = UID do Firebase Auth]
│   └── (Perfis completos de usuarios, administradores e credenciais de contato)
│
├── authorized_emails/   [ID do Doc = e-mail em minusculas]
│   └── (Tabela de pre-autorizacao para controle rigoroso de quem pode criar conta)
│
└── projects/            [ID do Doc = UUID do Projeto]
    └── (Projetos cadastrados contendo arrays de inspecoes, imagens e deteccoes)
```

---

## 2. Colecao: users (Perfis de Usuarios)

Armazena as informacoes cadastrais, cargo e papel de cada usuario autenticado.

* **Caminho no Firestore:** `users/{userId}`
* **Identificador do Documento (`userId`):** O mesmo `uid` gerado pelo servico Firebase Authentication (garante correspondencia 1:1).
* **Interface TypeScript:** [`backend/src/models/IUser.ts`](../backend/src/models/IUser.ts)

### Dicionario de Campos:

| Campo | Tipo | Obrigatorio | Descricao |
| :--- | :--- | :--- | :--- |
| `id` | String | Sim | O UID do Firebase Auth correspondente ao ID do documento. |
| `email` | String | Sim | E-mail corporativo do usuario (em minusculas). |
| `role` | String | Sim | Nivel de permissao: `'admin'` (Administrador) ou `'user'` (Usuario Padrao). |
| `name` | String | Nao | Nome completo do usuario. |
| `company` | String | Nao | Instituicao ou empresa a qual pertence (ex: "GETEC UFBA"). |
| `bio` | String | Nao | Resumo profissional ou cargo do engenheiro/inspetor. |
| `avatarUrl` | String | Nao | URL publica da foto de perfil hospedada no Cloud Storage. |
| `createdAt` | Timestamp / Date | Sim | Data e hora em que a conta foi concluida. |
| `securityQuestion`| String | Nao | Pergunta de seguranca complementar para redefinicao de senha. |
| `securityAnswer`  | String | Nao | Resposta de seguranca encriptada com hash. |

### Exemplo de Documento:
```json
{
  "id": "cM65TfRPhJN8LjGSbtxI6bdgFPj1",
  "email": "matheusrafael@ufba.br",
  "name": "Matheus Rafael",
  "company": "GETEC UFBA",
  "role": "admin",
  "bio": "Pesquisador e Desenvolvedor Lead",
  "avatarUrl": "https://firebasestorage.googleapis.com/v0/b/smart-twins-ie.firebasestorage.app/o/avatars%2F...%2Ffoto.jpeg",
  "createdAt": { "_seconds": 1789691845, "_nanoseconds": 322000000 }
}
```

---

## 3. Colecao: authorized_emails (Controle de Acesso e Pre-cadastro)

Originalmente utilizada para controle estrito de pre-autorizacao. Atualmente, o cadastro de usuarios na plataforma e aberto e direto (`POST /users`), sendo que `authorized_emails` e mantida para compatibilidade, atribuicao previa de cargos (`role: 'admin'`) ou politicas administrativas de pre-autorizacao.

* **Caminho no Firestore:** `authorized_emails/{email}`
* **Identificador do Documento (`email`):** E-mail sanitizado (em letras minusculas e sem espacos nas pontas, ex: `engenheiro@empresa.com`).

### Dicionario de Campos:

| Campo | Tipo | Obrigatorio | Descricao |
| :--- | :--- | :--- | :--- |
| `role` | String | Sim | Nivel de acesso que sera concedido: `'admin'` ou `'user'`. |
| `status` | String | Sim | `'pending'` (autorizado mas ainda nao concluiu cadastro) ou `'registered'` (conta criada). |
| `authorizedAt` | Timestamp | Sim | Momento em que o administrador autorizou o e-mail no painel. |
| `registeredAt` | Timestamp | Nao | Momento em que o usuario concluiu o primeiro login/cadastro. |
| `uid` | String | Nao | UID gerado no Firebase Auth anexado ao usuario quando ele conclui o registro. |

### Exemplo de Documento:
```json
{
  "role": "admin",
  "status": "registered",
  "authorizedAt": { "_seconds": 1789952899, "_nanoseconds": 827000000 },
  "registeredAt": { "_seconds": 1789952950, "_nanoseconds": 113000000 },
  "uid": "y7y25VDS9Sd3ZXuBO5SLP6HPAFt2"
}
```

---

## 4. Colecao: projects (Projetos, Inspecoes e Gemeos Digitais)

Armazena as estruturas de engenharia, subestacoes eletricas, predios e historicos de voo de drone com todas as deteccoes de anomalias encontradas, alem do acervo documental e tecnico da Biblioteca.

* **Caminho no Firestore:** `projects/{projectId}`
* **Identificador do Documento (`projectId`):** UUID v4 unico gerado pelo backend.
* **Interface TypeScript:** [`backend/src/models/IProject.ts`](../backend/src/models/IProject.ts)

### Dicionario de Campos Raiz:

| Campo | Tipo | Obrigatorio | Descricao |
| :--- | :--- | :--- | :--- |
| `id` | String | Sim | Identificador unico do projeto (UUID). |
| `userId` | String | Sim | UID do administrador que criou o projeto. |
| `name` | String | Sim | Nome da instalacao (ex: "Subestacao Salvador Norte" ou "Pavilhao de Aulas"). |
| `address` | String | Sim | Localizacao geografica ou endereco de campo. |
| `type` | String | Sim | Tipologia / Caracterizacao geral do ativo (ex: "Subestacao", "Predio", "Linha"). |
| `responsible` | String | Sim | Nome do engenheiro responsavel tecnico. |
| `coverImageUrl` | String | Nao | URL da foto de capa (upload customizado ou link externo). |
| `buildingYear` | String | Nao | Ano de construcao da infraestrutura. |
| `builtArea` | String | Nao | Area total construida em metros quadrados ($m^2$). |
| `facadeTypology`| String | Nao | Tipo de fachada sob a categoria de Sistemas (ex: "Pintura Acrilica", "Pastilha", "Vidro"). |
| `roofTypology` | String | Nao | Tipo de cobertura/telhado sob a categoria de Sistemas (ex: "Telha Ceramica", "Fibrocimento"). |
| `buildingAcronym` | String | Nao | Sigla identificadora da edificacao ou instalacao. |
| `unitDirector` | String | Nao | Diretor ou responsavel institucional da unidade. |
| `bimModelUrl` | String | Nao | Link para o modelo BIM/IFC tridimensional principal caso exista. |
| `omniverseLink` | String | Nao | Link de integracao com visualizador NVIDIA Omniverse. |
| `modules` | Object | Sim | Modulos ativos: `{ progress: bool, security: bool, maintenance: bool }`. |
| `inspections` | Array<IInspection> | Sim | Lista cronologica de todas as inspecoes (passadas e de projetos). |
| `cadFiles` | Array<ILibraryFile> | Nao | Projetos e desenhos tecnicos 2D (.DWG, .DXF, .PDF). |
| `bimFiles` | Array<ILibraryFile> | Nao | Modelos 3D e arquivos BIM (.IFC, .RVT, etc.). |
| `photogrammetryProducts` | Array<IPhotogrammetryBatch> | Nao | Levantamentos e produtos fotogrametricos organizados em lotes por data. |
| `onlyLibrary` | Boolean | Nao | Se `true`, indica que o ativo foi cadastrado exclusivamente pela Biblioteca e nao deve ser exibido na listagem de Projetos (fluxo unidirecional). |

---

### 4.1. Estrutura de Inspecao (`inspections[]`)

Cada elemento dentro da lista `inspections` representa uma campanha de inspecao realizada por drone, equipe terrestre ou acervo historico:

| Campo | Tipo | Descricao |
| :--- | :--- | :--- |
| `id` | String | Identificador unico da inspecao (UUID). |
| `inspectionType` | String | Tipo da inspecao (ex: "Voo Termografico", "Rotina Semestral", "Historico"). |
| `inspectionObjective` | String | Objetivo tecnico da missao. |
| `inspectionDate` | String | Data da captura dos dados (formato YYYY-MM-DD). |
| `inspectionResponsible` | String | Engenheiro de campo responsavel pelo voo ou registro. |
| `isPast` | Boolean | Se `true`, indica inspecao passada cadastrada via Biblioteca (permite upload livre de imagens e nao executa IA). Se `false` ou omitido, e uma inspecao originaria do modulo de Projetos (somente leitura na Biblioteca). |
| `orthoStatus` | String | Status de processamento atual da ortofoto (ou `null` se concluido). |
| `images` | Array<IImage> | Colecao de fotos individuais analisadas ou arquivadas. |
| `orthoResults` | Array<IOrthoResult> | Colecao de ortomosaicos GeoTIFF processados com analise geoespacial. |

---

### 4.2. Estrutura de Deteccao Convencional (`IDetection`)

Dentro de cada imagem individual em `images[].detections`:

```json
{
  "id": "det_7a9f8b",
  "class_name": "sujidade_no_telhado",
  "confidence": 0.89,
  "box": {
    "x1": 150.2,
    "y1": 80.5,
    "x2": 320.0,
    "y2": 240.8
  },
  "status": "pending",
  "maintenanceAt": "2026-09-25",
  "maintenanceResponsible": "Equipe de Limpeza Especializada",
  "maintenanceNotes": "Remocao quimica de biofilme e lavagem de alta pressao.",
  "maintenanceCost": 1200.00
}
```

---

### 4.3. Estrutura de Deteccao Geoespacial (`IGeoDetection`)

Dentro de cada ortomosaico em `orthoResults[].detections`:

Possui tanto as coordenadas em pixels sobre a ortofoto quanto as coordenadas geograficas globais extraidas via GDAL:

```json
{
  "id": "geo_c41e0a",
  "class_name": "trinca_em_isolador",
  "confidence": 0.93,
  "pixel_box": {
    "x1": 5420.0,
    "y1": 3110.0,
    "x2": 5680.0,
    "y2": 3390.0
  },
  "geo_box": {
    "lat1": -12.971520,
    "lon1": -38.512410,
    "lat2": -12.971590,
    "lon2": -38.512490
  },
  "center": {
    "lat": -12.971555,
    "lon": -38.512450
  },
  "status": "resolved",
  "maintenanceAt": "2026-09-22",
  "maintenanceResponsible": "Eletricista de Alta Tensao",
  "maintenanceNotes": "Substituicao completa do elemento isolador avariado.",
  "maintenanceCost": 650.00
}
```

---

### 4.4. Estrutura de Arquivos e Lotes da Biblioteca (`ILibraryFile` e `IPhotogrammetryBatch`)

Utilizada para o acervo tecnico e documental da edificacao dentro do modulo da Biblioteca (`cadFiles`, `bimFiles`, `photogrammetryProducts`):

#### A. Arquivo Tecnico da Biblioteca (`ILibraryFile`):
Representa um arquivo individual armazenado (DWG, DXF, PDF, IFC, RVT, LAS, OBJ, etc.):
```typescript
{
  "id": "lib_3c4d5e6f",
  "name": "Planta_Baixa_Pavimento_Terreo.dwg",
  "url": "https://firebasestorage.googleapis.com/.../Planta_Baixa.dwg",
  "size": 1458920,
  "uploadedAt": "2026-09-28T10:30:00.000Z",
  "format": "dwg",
  "category": "Arquitetura"
}
```

#### B. Lote de Produtos Fotogrametricos por Data (`IPhotogrammetryBatch`):
Agrupa arquivos e produtos derivados de levantamentos aereos organizados por missao/data:
```typescript
{
  "id": "photo_batch_89a0b1",
  "date": "2026-08-15",
  "title": "Levantamento Aereo Fachada Norte",
  "responsible": "Equipe de Drones GETEC",
  "description": "Nuvem de pontos densa e modelo tridimensional gerado via fotogrametria.",
  "files": [
    {
      "id": "lib_f1a2b3",
      "name": "nuvem_de_pontos.las",
      "url": "https://firebasestorage.googleapis.com/.../nuvem.las",
      "size": 84520100,
      "uploadedAt": "2026-08-15T16:00:00.000Z",
      "format": "las"
    }
  ]
}
```

---

## 5. Regras de Seguranca (firestore.rules)

Arquivo oficial: [`firestore.rules`](../firestore.rules)

O acesso direto ao Firestore atraves do navegador do cliente e protegido por regras declarativas avaliadas pelo servidor da Google:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Regra de usuarios: Qualquer usuario autenticado pode ler perfis para exibicao de colaboradores.
    // Porem, apenas o proprio dono do perfil pode editar seus dados pessoais.
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Regra geral para projetos, inspecoes e colecoes do sistema:
    // Permite leitura e escrita apenas para usuarios devidamente logados com token valido.
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

> **Nota de Arquitetura:** O Backend Node.js utiliza o **Firebase Admin SDK** (`service account`), que opera com privilegios de superadministrador e bypassa automaticamente as regras acima. Portanto, operacoes criticas como criacao de novos projetos, autorizacao de e-mails e atualizacoes de permissao sao blindadas no lado do servidor.

---

## 6. Estrategia de Backup e Exportacao

Para realizar copias de seguranca dos dados ou migrar o banco para outro projeto Google Cloud:

* **Exportacao Manual via gcloud CLI:**
  ```bash
  gcloud firestore export gs://smart-twins-ie.firebasestorage.app/backups/backup-$(date +%Y%m%d) --project smart-twins-ie
  ```
* **Importacao em Novo Projeto:**
  ```bash
  gcloud firestore import gs://smart-twins-ie.firebasestorage.app/backups/backup-DATA --project NOVO-PROJETO-ID
  ```
