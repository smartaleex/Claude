FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Wappalyzer and lxml
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libxml2-dev \
    libxslt-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app/ ./app/
COPY cli/ ./cli/
COPY frontend/ ./frontend/
COPY pyproject.toml .

# Create data directory for SQLite
RUN mkdir -p /data

ENV DATABASE_URL=sqlite+aiosqlite:////data/zetaris_prospects.db
ENV LOG_LEVEL=INFO
ENV PORT=8000

EXPOSE $PORT

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
