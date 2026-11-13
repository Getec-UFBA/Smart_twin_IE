#!/bin/bash
set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )/.." &> /dev/null && pwd )

WITH_DOCKER=false
if [[ "$*" == *"--with-docker"* ]]; then
    WITH_DOCKER=true
fi

echo "=================================================="
echo "      SMART TWIN-IE - Validação de Deploy & CI"
echo "=================================================="

echo "[1/4] Verificando sintaxe dos scripts de deploy..."
bash -n "$SCRIPT_DIR/deploy_ai.sh"
bash -n "$SCRIPT_DIR/deploy_fix.sh"
bash -n "$SCRIPT_DIR/scale_up_ai.sh"
bash -n "$SCRIPT_DIR/scale_down_ai.sh"
bash -n "$SCRIPT_DIR/start.sh"
echo "  ✓ Sintaxe dos scripts bash validada com sucesso."

echo "[2/4] Verificando configurações do Firebase e Dockerfile..."
if [ ! -f "$SCRIPT_DIR/firebase.json" ]; then
    echo "  ✗ ERRO: firebase.json não encontrado!"
    exit 1
fi
if [ ! -f "$SCRIPT_DIR/firestore.rules" ]; then
    echo "  ✗ ERRO: firestore.rules não encontrado!"
    exit 1
fi
if [ ! -f "$SCRIPT_DIR/storage.rules" ]; then
    echo "  ✗ ERRO: storage.rules não encontrado!"
    exit 1
fi
if [ ! -f "$SCRIPT_DIR/ai-service/Dockerfile" ]; then
    echo "  ✗ ERRO: ai-service/Dockerfile não encontrado!"
    exit 1
fi
echo "  ✓ Arquivos de infraestrutura validados."

echo "[3/4] Verificando integridade do Build do Backend e Testes..."
(cd "$SCRIPT_DIR/backend" && npm run build && npm run test:unit)
if [ ! -f "$SCRIPT_DIR/backend/dist/server.js" ]; then
    echo "  ✗ ERRO: backend/dist/server.js não foi gerado!"
    exit 1
fi
echo "  ✓ Backend compila e passa em todos os testes."

echo "[4/4] Verificando integridade do Build do Frontend e Testes..."
(cd "$SCRIPT_DIR/frontend" && npm run build && npm test)
if [ ! -f "$SCRIPT_DIR/frontend/dist/index.html" ]; then
    echo "  ✗ ERRO: frontend/dist/index.html não foi gerado!"
    exit 1
fi
echo "  ✓ Frontend compila e passa em todos os testes."

if [ "$WITH_DOCKER" = true ]; then
    echo "[DOCKER] Construindo imagem Docker do AI Service..."
    docker build -t smart-twin-ai:ci-test "$SCRIPT_DIR/ai-service"
    echo "  ✓ Imagem Docker compilada com sucesso."
else
    echo "Dica: Use './scripts/test-deploy.sh --with-docker' para compilar a imagem Docker do AI Service localmente."
fi

echo "=================================================="
echo "    Todas as verificações de deploy passaram!    "
echo "=================================================="
