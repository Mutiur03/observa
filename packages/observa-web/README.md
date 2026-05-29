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

That is all the setup needed. When the host app runs on `localhost`, `127.0.0.1`, `::1`, or `*.localhost`, the SDK automatically uses:

```ts
http://localhost:8000/v1
```

In production it automatically uses:

```ts
https://api.observa.dev/v1
```

Advanced users can still override it:

```ts
init({
  apiKey: "obspk_YOUR_PUBLIC_KEY",
  endpoint: "http://localhost:8000/v1",
  environment: "development",
});
```

React / Next.js:

```tsx
import { Observa } from "@observa/web/react";

<Observa apiKey="obspk_YOUR_PUBLIC_KEY" />
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
