#!/bin/bash
set -e

# Garantir que estamos na raiz do projeto
cd "$(dirname "$0")/.."

# Configurar Git safe.directory para o container
git config --global --add safe.directory "*" 2>/dev/null || true

echo "=========================================================="
echo "🚀 Configurando o ambiente de desenvolvimento Smart Twin IE"
echo "=========================================================="

# 1. Configurar ambiente Python e instalar dependências do AI Service
if [ -f "ai-service/requirements.txt" ]; then
    echo "[1/4] 🐍 Configurando o ambiente Python em ai-service..."
    
    # Verificar se o venv existente é funcional neste ambiente; se não for, recriar
    if [ -d "ai-service/venv" ]; then
        if ! ./ai-service/venv/bin/python --version &>/dev/null; then
            echo "   ⚠️ venv em ai-service/venv é incompatível ou corrompido neste ambiente. Recriando..."
            rm -rf ai-service/venv
        fi
    fi

    # Criar ambiente virtual se não existir
    if [ ! -d "ai-service/venv" ]; then
        echo "   Criando venv em ai-service/venv..."
        python3 -m venv ai-service/venv
    fi

    echo "   Instalando dependências no venv do ai-service..."
    ./ai-service/venv/bin/pip install --upgrade pip setuptools wheel
    ./ai-service/venv/bin/pip install --no-cache-dir -r ai-service/requirements.txt

    echo "   Instalando dependências no Python global..."
    pip install --break-system-packages --no-cache-dir -r ai-service/requirements.txt 2>/dev/null || \
    pip install --no-cache-dir -r ai-service/requirements.txt 2>/dev/null || true
fi

# 2. Instalar dependências Node.js da Raiz
if [ -f "package.json" ]; then
    echo "[2/4] 📦 Instalando dependências Node.js (Raiz)..."
    npm install
fi

# 3. Instalar dependências Node.js do Backend
if [ -f "backend/package.json" ]; then
    echo "[3/4] 📦 Instalando dependências Node.js (Backend)..."
    (cd backend && npm install && npx puppeteer browsers install chrome 2>/dev/null || true)
fi

# 4. Instalar dependências Node.js do Frontend
if [ -f "frontend/package.json" ]; then
    echo "[4/4] 📦 Instalando dependências Node.js (Frontend)..."
    (cd frontend && npm install)
fi

echo "=========================================================="
echo "✅ Ambiente configurado com sucesso!"
echo "💡 Execute './start.sh' para iniciar todos os serviços."
echo "=========================================================="
