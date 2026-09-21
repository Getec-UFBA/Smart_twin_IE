#!/bin/bash
set -e

PROJECT_ID="smart-twins-ie"
REGION="us-central1"

echo "=========================================="
echo "Aumentando recursos do AI Service (Alta Performance)"
echo "Configuracao: 8 GiB de RAM | 4 vCPUs"
echo "=========================================="

gcloud run services update ai-service \
  --memory 8Gi \
  --cpu 4 \
  --region "$REGION" \
  --project "$PROJECT_ID"

echo "=========================================="
echo "Recursos aumentados com sucesso para 8 GiB e 4 vCPUs!"
echo "=========================================="
