FROM python:3.11-slim

WORKDIR /app

# Install uv for fast dependency management
RUN pip install uv

# Copy dependency files and README (required by pyproject.toml)
COPY pyproject.toml uv.lock README.md ./

# Install dependencies (production only, skip editable project install)
RUN uv sync --frozen --no-dev --no-install-project

# Copy application code
COPY app ./app

# Expose port
EXPOSE 8000

# Run using the venv's Python directly (since project isn't installed)
CMD [".venv/bin/python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
