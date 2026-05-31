# Observa

Observa is an open-source, self-hosted observability and analytics platform for product and engineering teams.

It tracks frontend users, backend API requests, errors, sessions, custom events, jobs, webhooks, and API uptime monitoring in one clean dashboard.

## Features

- JWT authentication with registration, login, and current user endpoint
- Organization and project management
- Public and secret project API keys
- SDK-facing ingestion endpoints for events, errors, requests, sessions, jobs, and webhooks
- Dashboard APIs for overview metrics, event lists, errors, API requests, sessions, user timeline, and project stats
- API uptime monitors with stored checks
- Basic alert rule model for error thresholds, monitor down, slow endpoints, failed jobs, and failed webhooks
- Minimal JavaScript and Python SDK examples
- Docker Compose setup with FastAPI, Next.js, PostgreSQL, and Redis

## Architecture

```text
backend/
  app/
    api/routes/      HTTP endpoints
    services/        business logic
    repositories/    database queries
    schemas/         Pydantic DTOs
    models/          SQLAlchemy models
    core/            config, security, responses
frontend/
  src/app/           Next.js dashboard routes
  src/components/    reusable dashboard UI
packages/
  observa-web/       browser SDK example
  observa-python/    Python SDK example
```

## Tech Stack

- Backend: FastAPI, SQLAlchemy, Alembic, PostgreSQL, Pydantic, Redis-ready queue/realtime hooks
- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Auth: JWT for dashboard, API keys for ingestion

## Local Setup

```bash
cp .env.example .env
docker compose up --build
```

Services:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API docs: http://localhost:8000/docs

## Environment Variables

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL SQLAlchemy URL |
| `REDIS_URL` | Redis URL |
| `OBSERVA_API_KEY` | Secret project API key used by backend self-tracking |
| `OBSERVA_ENDPOINT` | Observa ingestion base URL, defaults to `http://127.0.0.1:8000/v1` |
| `JWT_SECRET_KEY` | JWT signing secret |
| `AUTH_COOKIE_NAME` | httpOnly auth cookie name |
| `AUTH_COOKIE_SECURE` | Use secure cookies in production |
| `AUTH_COOKIE_SAMESITE` | Cookie SameSite policy |
| `CORS_ORIGINS` | Allowed frontend origins |
| `NEXT_PUBLIC_API_URL` | Frontend API base URL |
| `SERVER_API_URL` | Internal API URL used by Next.js server-side fetch |

## API Examples

Register:

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"strong-password","full_name":"Admin"}'
```

Create organization:

```bash
curl -X POST http://localhost:8000/organizations \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme","slug":"acme"}'
```

Ingest event:

```bash
curl -X POST http://localhost:8000/v1/events \
  -H "X-Observa-Key: <project-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"custom_event","event_name":"checkout_started","properties":{"plan":"pro"}}'
```

## SDK Integration

The SDKs are local packages in this repository.

Browser app:

```bash
npm install ./packages/observa-web
```

```ts
import { init, identify, track, captureError, createTraceId } from "@observa/web";

init({
  apiKey: "obspk_YOUR_PUBLIC_KEY",
  endpoint: "http://localhost:8000/v1",
  environment: "production",
});

identify("user_123");
const traceId = createTraceId();
track("checkout_started", { plan: "pro" }, { traceId });
```

Plain browser snippet:

```html
<script src="/path/to/browser-snippet.js"></script>
<script>
  Observa.init({
    apiKey: "obspk_YOUR_PUBLIC_KEY",
    endpoint: "http://localhost:8000/v1",
    environment: "production"
  });
  Observa.identify("user_123");
  Observa.track("button_clicked", { button: "checkout" });
</script>
```

Python/FastAPI:

```bash
pip install -e ./packages/observa-python
```

```python
from observa import ObservaClient

observa = ObservaClient("obssk_YOUR_SECRET_KEY", endpoint="http://localhost:8000/v1")
app.middleware("http")(observa.fastapi_middleware())
```

Node/Express:

```bash
npm install ./packages/observa-node
```

```ts
import { createObserva } from "@observa/node";

const observa = createObserva({
  apiKey: "obssk_YOUR_SECRET_KEY",
  endpoint: "http://localhost:8000/v1",
});

app.use(observa.expressMiddleware());
```

## Roadmap

- Redis-backed ingestion rate limiting
- Background monitor scheduler
- WebSocket realtime dashboard updates
- Alert notifications for email, Slack, and webhooks
- Retention controls and rollup tables
- Production SDK packages

## Contributing

Contributions welcome. Keep code small, readable, tested, and aligned with existing backend layering.
