#!/bin/bash
# Get the absolute path of the script's directory
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

echo "==========================================="
echo "   Iniciando SMART TWIN-IE Platform"
echo "==========================================="

# Function to clean up background processes
cleanup() {
    echo ""
    echo "Encerrando serviços..."
    [ ! -z "$AI_PID" ] && kill $AI_PID 2>/dev/null
    [ ! -z "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null
    [ ! -z "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null
}

# Trap exit signals to run cleanup
trap cleanup EXIT SIGINT SIGTERM

# 1. Iniciar o serviço de IA (Python/YOLO)
echo "[1/3] Iniciando IA Service (Porta 8001)..."
(cd "$SCRIPT_DIR/ai-service" && . venv/bin/activate && uvicorn main:app --port 8001) &
AI_PID=$!

# 2. Iniciar o Backend (Node.js)
echo "[2/3] Iniciando API Backend (Porta 3001)..."
(cd "$SCRIPT_DIR/backend" && npm run dev) &
BACKEND_PID=$!

# 3. Iniciar o Frontend (React/Vite)
echo "[3/3] Iniciando Frontend..."
(cd "$SCRIPT_DIR/frontend" && npm run dev) &
FRONTEND_PID=$!

echo "==========================================="
echo "Serviços em execução. Pressione Ctrl+C para parar."
echo "==========================================="

# Wait for background processes
wait $AI_PID
wait $BACKEND_PID
wait $FRONTEND_PID
