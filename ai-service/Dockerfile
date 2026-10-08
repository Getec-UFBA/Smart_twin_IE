FROM python:3.9-slim

# Evita que o Python gere arquivos .pyc e permite logs em tempo real
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Instala dependências do sistema necessárias para OpenCV, Rasterio, GDAL e ferramentas de compilação
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    gdal-bin \
    libgdal-dev \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Define variáveis de ambiente para o Rasterio/GDAL
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

WORKDIR /app

# Copia apenas os requisitos primeiro para aproveitar o cache do Docker
COPY requirements.txt .

# Instala as dependências do Python
RUN pip install --no-cache-dir -r requirements.txt

# Instala o Chromium do Playwright com todas as dependências do sistema Linux necessárias para renderização de PDF
RUN playwright install --with-deps chromium

# Copia o restante do código
COPY . .

# Cria a pasta de outputs se não existir
RUN mkdir -p public/outputs

# O Cloud Run usa a variável de ambiente PORT. Se não definida, usamos 8001
ENV PORT=8001

# Comando para iniciar o serviço usando uvicorn
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
