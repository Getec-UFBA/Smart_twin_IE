#!/bin/bash
set -e

# riaz do projeto
cd "$(dirname "$0")/.."

# git
git config --global --add safe.directory "*" 2>/dev/null || true

# git LFS
if ! command -v git-lfs &>/dev/null; then
    echo "📦 Instalando Git LFS..."
    if command -v apt-get &>/dev/null; then
        sudo apt-get update && sudo apt-get install -y git-lfs 2>/dev/null || apt-get update && apt-get install -y git-lfs 2>/dev/null || true
    fi
    if ! command -v git-lfs &>/dev/null; then
        mkdir -p ~/.local/bin
        curl -sL https://github.com/git-lfs/git-lfs/releases/download/v3.5.1/git-lfs-linux-amd64-v3.5.1.tar.gz | tar -xz -C /tmp 2>/dev/null || true
        cp /tmp/git-lfs-3.5.1/git-lfs ~/.local/bin/ 2>/dev/null || true
    fi
    git lfs install 2>/dev/null || true
fi

echo "=========================================================="
echo "🚀 Configurando o ambiente de desenvolvimento Smart Twin IE"
echo "=========================================================="

# instalar dep
if [ -f "ai-service/requirements.txt" ]; then
    echo "[1/4]  Configurando o ambiente Python em ai-service..."
    
    # verifica se n existe
    if [ -d "ai-service/venv" ]; then
        if ! ./ai-service/venv/bin/python --version &>/dev/null; then
            echo "   venv em ai-service/venv é incompatível ou corrompido neste ambiente. Recriando..."
            rm -rf ai-service/venv
        fi
    fi

    # cria venv se nao existir
    if [ ! -d "ai-service/venv" ]; then
        echo "   Criando venv em ai-service/venv..."
        python3 -m venv ai-service/venv
        echo "   Instalando dependências no venv do ai-service..."
        ./ai-service/venv/bin/pip install --upgrade pip setuptools wheel
        ./ai-service/venv/bin/pip install --no-cache-dir -r ai-service/requirements.txt
    else
        echo "    venv em ai-service/venv já existe."
    fi
fi

# dep node raiz
if [ -f "package.json" ]; then
    if [ ! -d "node_modules" ]; then
        echo "[2/4] 📦 Instalando dependências Node.js (Raiz)..."
        npm install
    else
        echo "[2/4] node_modules da raiz já existe."
    fi
fi

# node back
if [ -f "backend/package.json" ]; then
    if [ ! -d "backend/node_modules" ]; then
        echo "[3/4] 📦 Instalando dependências Node.js (Backend)..."
        (cd backend && npm install && npx puppeteer browsers install chrome 2>/dev/null || true)
    else
        echo "[3/4]  backend/node_modules já existe."
    fi
fi

# 4. node front
if [ -f "frontend/package.json" ]; then
    if [ ! -d "frontend/node_modules" ]; then
        echo "[4/4] 📦 Instalando dependências Node.js (Frontend)..."
        (cd frontend && npm install)
    else
        echo "[4/4]  frontend/node_modules já existe."
    fi
fi

echo "=========================================================="
echo "Ambiente configurado com sucesso!"
echo " Execute './start.sh' para iniciar todos os serviços."
echo "=========================================================="
