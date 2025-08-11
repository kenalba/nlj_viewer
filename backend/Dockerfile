# Use Python 3.11 slim image for optimal size and security
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast Python package management
RUN pip install uv

# Set work directory
WORKDIR /app

# Copy dependency files and README for package build
COPY pyproject.toml README.md ./

# Create virtual environment and install dependencies
RUN uv venv .venv --python /usr/local/bin/python3 && \
    . .venv/bin/activate && \
    uv pip install -e ".[dev]"

# Copy application code
COPY . .

# Ensure the virtual environment packages are accessible
ENV PYTHONPATH="/app:/app/.venv/lib/python3.11/site-packages"

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command for development
CMD ["/usr/local/bin/python3", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]