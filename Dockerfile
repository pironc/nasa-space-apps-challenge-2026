# One container: FastAPI serves the built frontend and /api.
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /bin/uv
# Same layout as the repo: app/main.py looks for ../frontend/dist
WORKDIR /srv/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/app ./app
COPY --from=web /web/dist /srv/frontend/dist
# Cloud Run's disk is memory: the cache is rebuilt on demand, presets are static files in dist
ENV DATA_DIR=/tmp/data PORT=8080
# One worker: the build limit and the upstream concurrency cap are per process
CMD ["sh", "-c", "uv run --frozen --no-sync uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
