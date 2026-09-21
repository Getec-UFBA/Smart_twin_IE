#!/bin/bash
set -e

PROJECT_ID="smart-twins-ie"
REGION="us-central1"

echo "=========================================="
echo "Reduzindo recursos do AI Service (Modo Economico)"
echo "Configuracao: 2 GiB de RAM | 1 vCPU"
echo "=========================================="

gcloud run services update ai-service \
  --memory 2Gi \
  --cpu 1 \
  --region "$REGION" \
  --project "$PROJECT_ID"

echo "=========================================="
echo "Recursos reduzidos com sucesso para 2 GiB e 1 vCPU!"
echo "=========================================="
