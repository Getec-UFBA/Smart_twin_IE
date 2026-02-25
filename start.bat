@echo off
echo ===========================================
echo    Iniciando SMART TWIN-IE Platform
echo ===========================================

:: 1. Iniciar o serviço de IA
echo [1/3] Iniciando IA Service (Python/YOLO)...
:: Opção com venv (Padrão):
start "IA Service" cmd /k "cd ai-service && venv\Scripts\activate && uvicorn main:app --port 8001"
:: Opção sem venv (caso não queira usar pasta virtual):
:: start "IA Service" cmd /k "cd ai-service && uvicorn main:app --port 8001"

:: 2. Iniciar o Backend
echo [2/3] Iniciando API Backend (Node.js)...
start "API Backend" cmd /k "cd backend && npm run dev"

:: 3. Iniciar o Frontend
echo [3/3] Iniciando Frontend (Vite)...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo ===========================================
echo Todos os servicos foram disparados.
echo Verifique as janelas individuais para logs.
echo ===========================================
pause
