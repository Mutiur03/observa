# @observa/node

Node.js SDK for Observa.

## Install

```bash
npm install @observa/node
```

## Express

```ts
import express from "express";
import { createObserva } from "@observa/node";

const app = express();
const observa = createObserva("obssk_YOUR_SECRET_KEY");

app.use(observa.expressMiddleware());

// Keep this after your routes and before your final error response handler.
app.use(observa.expressErrorMiddleware());
```

That automatically tracks:

- API requests
- status codes and durations
- generated `X-Trace-Id`
- backend errors that reach Express error handling

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
const observa = createObserva();
```

Self-hosted Observa:

```ts
const observa = createObserva({
  apiKey: "obssk_YOUR_SECRET_KEY",
  endpoint: "http://localhost:8000/v1",
});
```
