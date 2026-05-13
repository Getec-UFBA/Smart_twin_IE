#!/bin/bash
set -e

# Get the absolute path of the backend directory
BACKEND_DIR=$(pwd)

echo "Instalando dependências do Backend..."
npm install

echo "Configurando segredos no Firebase..."

# Função para extrair valor do .env
get_env_val() {
    local key=$1
    local val=$(grep "^${key}=" .env | cut -d'=' -f2- | sed 's/^"//;s/"$//')
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
    echo "ERRO: FIREBASE_PRIVATE_KEY não encontrada no .env"
    exit 1
fi

echo "Enviando segredos..."
printf "%s" "$PROJECT_ID" | firebase functions:secrets:set PROJECT_ID_FB || true
printf "%s" "$CLIENT_EMAIL" | firebase functions:secrets:set CLIENT_EMAIL_FB || true
printf "%s" "$STORAGE_BUCKET" | firebase functions:secrets:set STORAGE_BUCKET_FB || true
printf "%s" "$JWT_SECRET" | firebase functions:secrets:set JWT_SECRET_FB || true
printf "%s" "$PYTHON_SERVICE_URL" | firebase functions:secrets:set PYTHON_SERVICE_URL || true
printf "%s" "$PRIVATE_KEY" | firebase functions:secrets:set PRIVATE_KEY_FB || true

echo "Segredos configurados."

echo "Iniciando Build do Frontend..."
cd ../frontend
npm run build
cd "$BACKEND_DIR"

echo "Iniciando deploy do Backend e Hosting..."

# Renomeia .env para evitar conflitos no Firebase Functions V2
mv "$BACKEND_DIR/.env" "$BACKEND_DIR/.env.bak"
trap "mv '$BACKEND_DIR/.env.bak' '$BACKEND_DIR/.env'" EXIT

cd ..
firebase deploy --only functions,hosting
