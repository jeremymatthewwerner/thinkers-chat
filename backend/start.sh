#!/bin/bash
# Start the FastAPI backend
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
