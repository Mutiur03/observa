# @mutiur03/observa-node

Node.js SDK for Observa.

## Install

```bash
npm install @mutiur03/observa-node
```

## Express

```ts
import express from "express";
import { createObserva } from "@mutiur03/observa-node";

const app = express();
createObserva("obssk_YOUR_SECRET_KEY").installExpress(app);
```

That is all the setup needed. In development, the SDK automatically sends to `http://localhost:8000/v1`. In production, set `NODE_ENV=production` and it sends to `https://observa-api.mutiurrahman.com/v1`.

That automatically tracks:

- API requests
- status codes and durations
- generated `X-Trace-Id`
- backend errors that reach Express error handling

Request tracking records `source`, `client_ip`, and `user_agent`. Source resolution uses `Origin`, then `Referer`, then forwarded or direct client IP.

## Optional

```ts
await observa.track("checkout_started", { properties: { plan: "pro" } });
await observa.trackJob({ jobName: "nightly_sync", status: "completed" });
```

Environment-based setup also works:

```bash
OBSERVA_SECRET_KEY=obssk_YOUR_SECRET_KEY
```

```ts
createObserva().installExpress(app);
```
