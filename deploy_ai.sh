#!/bin/bash
set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
PROJECT_ID="smart-twins-ie"
REGION="us-central1"

echo "=========================================="
echo "Iniciando Deploy do AI Service (Cloud Run)"
echo "Projeto: $PROJECT_ID | Regiao: $REGION"
echo "=========================================="

# Garante que o gcloud use o projeto correto
gcloud config set project "$PROJECT_ID"

echo "[1/2] Enviando codigo para o Cloud Build e implantando no Cloud Run..."
gcloud run deploy ai-service \
  --source "$SCRIPT_DIR/ai-service" \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 8Gi \
  --cpu 4 \
  --timeout 900 \
  --concurrency 1 \
  --project "$PROJECT_ID"

echo "=========================================="
echo "Deploy do AI Service concluido com sucesso!"
echo "=========================================="
