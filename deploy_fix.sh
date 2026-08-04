#!/bin/bash
set -e

# Obter o caminho absoluto do diretório raiz do projeto
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "=========================================="
echo " Iniciando Deploy do Smart Twin IE..."
echo "=========================================="

echo "[1/4] Instalando dependências do Backend..."
(cd "$BACKEND_DIR" && npm install)

echo "[2/4] Configurando segredos no Firebase..."
ENV_FILE="$BACKEND_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "ERRO: Arquivo $ENV_FILE não encontrado em $BACKEND_DIR"
    exit 1
fi

# Função para extrair valor do .env
get_env_val() {
    local key=$1
    local val=$(grep "^${key}=" "$ENV_FILE" | cut -d'=' -f2- | sed 's/^"//;s/"$//')
    echo "$val"
}

# Extrair valores
PROJECT_ID=$(get_env_val "FIREBASE_PROJECT_ID")
CLIENT_EMAIL=$(get_env_val "FIREBASE_CLIENT_EMAIL")
STORAGE_BUCKET=$(get_env_val "FIREBASE_STORAGE_BUCKET")
JWT_SECRET=$(get_env_val "JWT_SECRET")
PYTHON_SERVICE_URL=$(get_env_val "PYTHON_SERVICE_URL")
PRIVATE_KEY=$(get_env_val "FIREBASE_PRIVATE_KEY")

if [ -z "$PRIVATE_KEY" ]; then
    echo "ERRO: FIREBASE_PRIVATE_KEY não encontrada no arquivo $ENV_FILE"
    exit 1
fi

echo "Enviando segredos..."
(
    cd "$SCRIPT_DIR"
    printf "%s" "$PROJECT_ID" | firebase functions:secrets:set PROJECT_ID_FB || true
    printf "%s" "$CLIENT_EMAIL" | firebase functions:secrets:set CLIENT_EMAIL_FB || true
    printf "%s" "$STORAGE_BUCKET" | firebase functions:secrets:set STORAGE_BUCKET_FB || true
    printf "%s" "$JWT_SECRET" | firebase functions:secrets:set JWT_SECRET_FB || true
    printf "%s" "$PYTHON_SERVICE_URL" | firebase functions:secrets:set PYTHON_SERVICE_URL || true
    printf "%s" "$PRIVATE_KEY" | firebase functions:secrets:set PRIVATE_KEY_FB || true
)

echo "Segredos configurados com sucesso."

echo "[3/4] Iniciando Build do Frontend..."
(cd "$FRONTEND_DIR" && npm run build)

echo "[4/4] Iniciando deploy no Firebase..."

# Temporariamente renomeia o .env do backend para evitar conflitos no Firebase Functions V2 durante o deploy
if [ -f "$ENV_FILE" ]; then
    mv "$ENV_FILE" "$BACKEND_DIR/.env.bak"
    trap "mv '$BACKEND_DIR/.env.bak' '$ENV_FILE' 2>/dev/null || true" EXIT
fi

(
    cd "$SCRIPT_DIR"
    firebase deploy --only functions,hosting
)

echo "=========================================="
echo "✅ Deploy concluído com sucesso!"
echo "=========================================="
