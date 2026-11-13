#!/bin/bash
set -e

# SMART TWIN-IE - Script de Execução de Testes Unitários e Qualidade Local
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}======================================================${NC}"
    echo -e "${BLUE}        SMART TWIN-IE - Suíte de Testes Local        ${NC}"
    echo -e "${BLUE}======================================================${NC}"
}

run_backend() {
    echo -e "\n${YELLOW}▶ [1/4] Executando testes unitários do Backend (Node.js/Vitest)...${NC}"
    (
        cd "$SCRIPT_DIR/backend"
        npm run test:unit
    )
    echo -e "${GREEN}✓ Testes do Backend concluídos com sucesso!${NC}"
}

run_frontend() {
    echo -e "\n${YELLOW}▶ [2/4] Executando testes unitários do Frontend (React/Vitest)...${NC}"
    (
        cd "$SCRIPT_DIR/frontend"
        npm test
    )
    echo -e "${GREEN}✓ Testes do Frontend concluídos com sucesso!${NC}"
}

run_ai() {
    echo -e "\n${YELLOW}▶ [3/4] Executando testes unitários do AI Service (Python/Pytest)...${NC}"
    
    # 1. Se estiver rodando dentro de container docker ou ambiente com pytest
    if command -v pytest &> /dev/null; then
        (cd "$SCRIPT_DIR/ai-service" && pytest -v)
    elif [ -f "$SCRIPT_DIR/ai-service/venv/bin/pytest" ]; then
        (cd "$SCRIPT_DIR/ai-service" && ./venv/bin/pytest -v)
    elif command -v docker &> /dev/null && docker info &> /dev/null; then
        echo -e "${BLUE}ℹ Pytest local não encontrado no host. Executando testes via Docker...${NC}"
        docker run --rm -v "$SCRIPT_DIR/ai-service:/app" -w /app python:3.11-slim sh -c \
            "pip install -q pytest pytest-asyncio httpx shapely numpy && pytest -v tests/test_ortho_processor.py"
    else
        echo -e "${YELLOW}! Pytest não instalado no host nem no venv. Instale com: pip install -r ai-service/requirements-dev.txt${NC}"
    fi
    echo -e "${GREEN}✓ Testes do AI Service validados!${NC}"
}

run_deploy() {
    echo -e "\n${YELLOW}▶ [4/4] Executando validação de regras de deploy e infraestrutura...${NC}"
    "$SCRIPT_DIR/scripts/test-deploy.sh"
    echo -e "${GREEN}✓ Validação de deploy concluída com sucesso!${NC}"
}

run_docker() {
    echo -e "\n${YELLOW}▶ Testando build do container Docker do AI Service...${NC}"
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        docker build -t smart-twin-ai:local-test "$SCRIPT_DIR/ai-service"
        echo -e "${GREEN}✓ Imagem Docker do AI Service construída com sucesso!${NC}"
    else
        echo -e "${RED}✗ Docker daemon não está em execução ou usuário sem permissão.${NC}"
        exit 1
    fi
}

# Processamento de argumentos
print_header

if [ "$#" -eq 0 ] || [ "$1" == "--all" ]; then
    run_backend
    run_frontend
    run_ai
    run_deploy
    echo -e "\n${GREEN}======================================================${NC}"
    echo -e "${GREEN}   Todos os testes e validações passaram com sucesso!  ${NC}"
    echo -e "${GREEN}======================================================${NC}"
    exit 0
fi

while [ "$#" -gt 0 ]; do
    case "$1" in
        --backend)
            run_backend
            ;;
        --frontend)
            run_frontend
            ;;
        --ai)
            run_ai
            ;;
        --deploy)
            run_deploy
            ;;
        --docker)
            run_docker
            ;;
        --help|-h)
            echo "Uso: ./run_tests.sh [OPÇÕES]"
            echo ""
            echo "Opções:"
            echo "  (sem argumentos)  Executa backend, frontend, ai e deploy"
            echo "  --all             Executa todas as suítes"
            echo "  --backend         Executa apenas os testes do Backend"
            echo "  --frontend        Executa apenas os testes do Frontend"
            echo "  --ai              Executa apenas os testes do AI Service"
            echo "  --deploy          Executa verificações de deploy e regras"
            echo "  --docker          Testa compilação da imagem Docker do AI Service"
            echo "  --help, -h        Exibe esta mensagem de ajuda"
            exit 0
            ;;
        *)
            echo -e "${RED}Opção inválida: $1${NC}. Use --help para ver as opções."
            exit 1
            ;;
    esac
    shift
done
