# Ciclo de Vida e Fluxo de Dados da Inspecao Tecnica
### Smart Twin IE (Smart Inspects) — Arquitetura de Negocio de Ponta a Ponta

> **Finalidade deste documento:** Este manual descreve minuciosamente o ciclo de vida completo de uma inspecao tecnica na plataforma Smart Twin IE, desde o voo do drone e captura de dados em campo ate o processamento geoespacial com IA, revisao humana e emissao de relatorios periciais em PDF.

---

## Indice

1. [Visao Geral do Fluxo (Diagrama de Estados)](#1-visao-geral-do-fluxo-diagrama-de-estados)
2. [Etapa 1: Planejamento e Cadastro da Inspecao](#2-etapa-1-planejamento-e-cadastro-da-inspecao)
3. [Etapa 2: Ingestao e Upload de Imagens e Ortomosaicos](#3-etapa-2-ingestao-e-upload-de-imagens-e-ortomosaicos)
4. [Etapa 3: Processamento Geoespacial e Inferencia com IA](#4-etapa-3-processamento-geoespacial-e-inferencia-com-ia)
5. [Etapa 4: Revisao Humana (Human-in-the-Loop)](#5-etapa-4-revisao-humana-human-in-the-loop)
6. [Etapa 5: Gestao de Patologias e Status de Manutencao](#6-etapa-5-gestao-de-patologias-e-status-de-manutencao)
7. [Etapa 6: Geracao e Emissao do Relatorio Tecnico em PDF](#7-etapa-6-geracao-e-emissao-do-relatorio-tecnico-em-pdf)

---

## 1. Visao Geral do Fluxo (Diagrama de Estados)

```text
[Voo do Drone / Fotos de Campo]
               |
               v
 [Upload na Plataforma Web (Frontend)]
               |
               v
   [Backend Node.js (API Express)]
               |
               +---> [Upload de Arquivos Brutos para o Cloud Storage]
               |
               +---> [Disparo Assincrono para o Microservico de IA (Cloud Run)]
                            |
                            v
              [Fatiamento em Janelas Deslizantes (1024x1024)]
                            |
                            v
             [Inferencia YOLO + Extracao Geoespacial GDAL]
                            |
                            v
             [Fusao de Deteccoes Sobrepostas via Shapely]
                            |
                            v
       [Criacao do GeoTIFF Anotado e Preview Compacto JPG]
                            |
                            v
               [Webhook Callback para o Backend API]
                            |
                            v
          [Persistencia dos Resultados no Cloud Firestore]
                            |
                            v
            [Interface de Revisao Humana no Frontend]
             (Engenheiro valida ou ajusta deteccoes)
                            |
                            v
       [Acompanhamento de Manutencoes e Patologias]
                            |
                            v
         [Emissao do Relatorio Tecnico Oficial em PDF]
```

---

## 2. Etapa 1: Planejamento e Cadastro da Inspecao

1. **Acesso do Administrador:** O engenheiro ou gestor acessa o painel em [`frontend/src/pages/Projetos/`](../frontend/src/pages/Projetos).
2. **Criacao do Projeto:** Se a subestacao, linha de transmissao ou edificacao ainda nao existir no sistema, ele cria um novo registro com nome, endereco, tipologia, ano de construcao e responsavel tecnico.
3. **Agendamento da Inspecao:** Dentro do projeto, cria-se uma inspecao tecnica informando:
   * Tipo da inspecao (ex: *Voo Drone Termografia*, *Inspecao Visual Fachada*, *Rotina Telhado*).
   * Objetivo detalhado.
   * Data programada e responsavel de campo.
4. **Persistencia:** O backend grava a inspecao no array `inspections` dentro do documento do projeto no Cloud Firestore.

---

## 3. Etapa 2: Ingestao e Upload de Imagens e Ortomosaicos

A plataforma suporta dois tipos principais de dados de inspecao:

### A. Fotos Isoladas em Alta Definicao (JPG/PNG)
* Fotos detalhadas tiradas com camera convencional ou drone focado em isoladores, ferragens, para-raios ou transformadores.
* O frontend envia as fotos para a rota `POST /api/projects/process-images`.
* O backend utiliza streaming de dados (`Busboy`) para evitar consumo excessivo de memoria e envia as fotos diretamente para o servico de IA.

### B. Ortomosaico Completo GeoTIFF (.tif / .tiff)
* Arquivos georreferenciados gerados por softwares de fotogrametria (ex: WebODM, Pix4D, Agisoft Metashape), pesando frequentemente entre 200 MB e 3 GB.
* O frontend transmite o arquivo para `POST /api/projects/process-ortho`.
* O backend cria um registro de processamento pendente (`orthoStatus: "Enviado para analise..."`) e delega a computacao pesada ao servico de IA no Cloud Run.

---

## 4. Etapa 3: Processamento Geoespacial e Inferencia com IA

Modulo responsavel: [`ai-service/ortho_processor.py`](../ai-service/ortho_processor.py) e [`ai-service/main.py`](../ai-service/main.py)

Devido ao tamanho massivo das imagens GeoTIFF, o processador adota uma metodologia avancada de divisao matricial:

### 1. Fatiamento em Janelas Deslizantes (Tiling)
* A ortofoto e particionada em blocos quadrados de **1024x1024 pixels**, com uma margem de sobreposicao (`overlap`) de **250 pixels**.
* *Por que o overlap?* Elementos situados na borda de um corte seriam cortados ao meio e nao reconhecidos pelo modelo neural. A sobreposicao garante que qualquer defeito apareca inteiro em pelo menos uma fatia.

### 2. Inferencia Neural (YOLO)
* Cada bloco e submetido ao modelo neural treinado (`models/best.onnx` ou `best (3).pt`).
* O modelo detecta as anomalias e componentes (ex: trincas, biofilme, corrosao, componentes danificados), registrando confianca e coordenadas matriciais relativas ao bloco.

### 3. Transformacao Afim e Georreferenciamento (Rasterio / GDAL)
* O algoritmo aplica a matriz de transformacao afim (`transform * (pixel_x, pixel_y)`) da ortofoto para converter os pixels em coordenadas geograficas reais no globo (Latitude, Longitude e sistema de coordenadas projetadas UTM).

### 4. Resolucao de Duplicidades (Shapely)
* Deteccoes repetidas geradas pela margem de sobreposicao de 250px sao unificadas utilizando a operacao `unary_union` e calculo de IoU (*Intersection over Union*) espacial da biblioteca Shapely.

### 5. Monitoramento em Tempo Real (Pings de Status)
* Durante os 2 a 10 minutos de computacao, o microservico de IA dispara pings periodicos para `POST /api/projects/ortho-status` informando o progresso (ex: *Processando bloco 45 de 180...*).
* O usuario acompanha esse status em tempo real na tela do frontend.

### 6. Entrega dos Resultados (Webhook Callback)
* Ao concluir, a IA gera:
  1. O GeoTIFF anotado (`annotated_<id>.tif`) com caixas desenhadas sobre a imagem de alta resolucao.
  2. Um preview JPG leve (`preview_<id>.jpg`) para exibicao rapida no navegador sem travar a interface.
* O servico chama `POST /api/projects/ortho-callback` transmitindo a lista completa de anomalias com coordenadas geograficas. O backend atualiza o Firestore e conclui a etapa automatica.

---

## 5. Etapa 4: Revisao Humana (Human-in-the-Loop)

Modulo responsavel: [`frontend/src/pages/ReviewImages/`](../frontend/src/pages/ReviewImages) e [`frontend/src/pages/ProjectView/`](../frontend/src/pages/ProjectView)

A plataforma segue o principio de IA assistida: a tecnologia aponta as suspeitas, mas o engenheiro tem a palavra final:

1. O inspetor visualiza todas as fotos com as deteccoes sugeridas pela IA.
2. E possivel:
   * **Confirmar:** Validar a anomalia identificada.
   * **Rejeitar:** Descartar falsos positivos causados por sombras, reflexos ou sujeira comum.
   * **Ajustar:** Alterar a classificacao ou severidade da patologia.
3. Ao finalizar, o frontend envia a confirmacao para `POST /api/projects/review/:reviewId/save`, que grava as deteccoes definitivas no Firestore.

---

## 6. Etapa 5: Gestao de Patologias e Status de Manutencao

Modulo responsavel: [`frontend/src/components/MaintenanceFeedback/`](../frontend/src/components/MaintenanceFeedback)

Com o gemeo digital carregado no mapa:

* Cada defeito identificado recebe um marcador interativo georreferenciado sobre a estrutura ou telhado.
* Os engenheiros podem registrar o ciclo de manutencao:
  * **Status:** `pending` (Pendente) ou `resolved` (Resolvido).
  * **Data da Manutencao:** Quando o reparo foi executado.
  * **Responsavel:** Nome do operador ou empresa contratada.
  * **Custo do Reparo:** Valor financeiro gasto na intervencao.
  * **Notas Tecnicas:** Relato dos materiais e procedimentos adotados.
* A rota `PATCH /api/projects/:projectId/inspections/:inspectionId/detections` consolida essas informacoes, permitindo auditoria historica do ativo eletrico.

---

## 7. Etapa 6: Geracao e Emissao do Relatorio Tecnico em PDF

Modulo responsavel: [`backend/src/services/ReportService.ts`](../backend/src/services/ReportService.ts) e [`ai-service/main.py`](../ai-service/main.py#L157-L201)

1. **Requisicao do Documento:** O usuario clica em **Exportar Relatorio PDF** na interface da inspecao.
2. **Montagem dos Dados no Backend:** O `ReportService` le o projeto no Firestore e constroi uma pagina HTML completa contendo:
   * Cabecalho oficial com logotipo do GETEC e da UFBA.
   * Dados cadastrais do ativo (ano, area, responsavel, tipologia).
   * Graficos e tabelas estatisticas de conformidade por classe de defeito (C01 a C10).
   * Lista detalhada de anomalias com recorte das fotos, coordenadas geograficas, status de correcao e custo.
   * Rodape numerado com carimbo de data e hora pericial.
3. **Renderizacao no Cloud Run:** O backend envia o HTML para `POST /generate-pdf` no microservico de IA.
4. **Motor Chromium Nativo:** O Chromium (gerenciado via Playwright) renderiza o documento e imprime o PDF em formato A4 com qualidade grafica total.
5. **Download Seguro:** O arquivo binario e transmitido de volta ao navegador do usuario como anexo (`relatorio-inspecao-<id>.pdf`), finalizando com sucesso o ciclo da inspecao.
