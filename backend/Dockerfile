FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY packages/observa-python /packages/observa-python
RUN pip install --no-cache-dir /packages/observa-python

COPY backend/pyproject.toml backend/alembic.ini ./
COPY backend/alembic ./alembic
COPY backend/app ./app

RUN pip install --no-cache-dir .

EXPOSE 8000
CMD ["fastapi", "run", "app/main.py", "--port", "8000"]
