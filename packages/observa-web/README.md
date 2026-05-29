# @observa/web

Browser SDK for Observa.

## Install

```bash
npm install @observa/web
```

## One-line Setup

```ts
import { init } from "@observa/web";

init("obspk_YOUR_PUBLIC_KEY");
```

That automatically tracks:

- page views, including SPA route changes
- frontend errors and unhandled promise rejections
- browser `fetch` API requests with `X-Trace-Id`
- session start/end events

## Optional

```ts
import { identify, track, captureError } from "@observa/web";

identify("user_123");
track("checkout_started", { plan: "pro" });
captureError(new Error("Example"));
```

Self-hosted Observa:

```ts
init({
  apiKey: "obspk_YOUR_PUBLIC_KEY",
  endpoint: "http://localhost:8000/v1",
});
```
