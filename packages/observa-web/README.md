# @mutiur03/observa-web

Browser SDK for Observa.

## Install

```bash
npm install @mutiur03/observa-web
```

## One-line Setup

```ts
import { init } from "@mutiur03/observa-web";

init("obspk_YOUR_PUBLIC_KEY");
```

That is all the setup needed. When the host app runs on `localhost`, `127.0.0.1`, `::1`, or `*.localhost`, the SDK automatically uses:

```ts
http://localhost:8000/v1
```

In production it automatically uses:

```ts
https://observa-api.mutiurrahman.com/v1
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
import { Observa } from "@mutiur03/observa-web/react";

<Observa apiKey="obspk_YOUR_PUBLIC_KEY" />
```

That automatically tracks:

- page views, including SPA route changes
- frontend errors and unhandled promise rejections
- session start/end events

## Optional

```ts
import { identify, track, captureError } from "@mutiur03/observa-web";

identify("user_123");
track("checkout_started", { plan: "pro" });
captureError(new Error("Example"));
```

Browser API request tracking is off by default. Track API requests from server SDKs to avoid client-navigation noise. Explicit client opt-in remains available:

```ts
init({
  apiKey: "obspk_YOUR_PUBLIC_KEY",
  autoTrack: { fetch: true },
});
```
