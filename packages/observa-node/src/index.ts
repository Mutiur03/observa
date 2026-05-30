type ObservaOptions = {
  apiKey?: string;
  endpoint?: string;
  environment?: string;
  timeoutMs?: number;
};

type TrackOptions = {
  userId?: string;
  sessionId?: string;
  traceId?: string;
  properties?: Record<string, unknown>;
};

type ExpressRequest = {
  method: string;
  path?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  user?: { id?: string | number } | undefined;
  headers: Record<string, string | string[] | undefined>;
};

type ExpressResponse = {
  statusCode: number;
  writableEnded?: boolean;
  setHeader(name: string, value: string): void;
  getHeader(name: string): number | string | string[] | undefined;
  on(event: "finish", listener: () => void): void;
};

type ExpressNext = (error?: unknown) => void;
type ExpressApp = {
  use(...handlers: unknown[]): unknown;
};

const HOSTED_ENDPOINT = "https://observa-api.mutiurrahman.com/v1";
const LOCAL_ENDPOINT = "http://localhost:8000/v1";

declare const process:
  | {
    env?: Record<string, string | undefined>;
  }
  | undefined;

export class ObservaNode {
  private apiKey?: string;
  private endpoint: string;
  private environment: string;
  private timeoutMs: number;

  constructor(input: string | ObservaOptions = {}) {
    const options = typeof input === "string" ? { apiKey: input } : input;
    this.apiKey = options.apiKey ?? process?.env?.OBSERVA_API_KEY ?? process?.env?.OBSERVA_SECRET_KEY;
    this.environment = options.environment ?? process?.env?.OBSERVA_ENVIRONMENT ?? process?.env?.NODE_ENV ?? "development";
    this.endpoint = resolveEndpoint(options.endpoint ?? process?.env?.OBSERVA_ENDPOINT, this.environment);
    this.timeoutMs = options.timeoutMs ?? 3000;
  }

  createTraceId() {
    return createTraceId();
  }

  track(eventName: string, options: TrackOptions = {}) {
    return this.send("/events", {
      event_type: "custom_event",
      event_name: eventName,
      user_id: options.userId,
      session_id: options.sessionId,
      trace_id: options.traceId,
      properties: options.properties ?? {},
      environment: this.environment,
    });
  }

  captureError(error: unknown, options: TrackOptions = {}) {
    const normalized = normalizeError(error);
    return this.send("/errors", {
      error_type: normalized.name,
      message: normalized.message,
      stack_trace: normalized.stack,
      source: "backend",
      user_id: options.userId,
      session_id: options.sessionId,
      trace_id: options.traceId,
      properties: options.properties ?? {},
    });
  }

  trackRequest(input: {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    userId?: string;
    sessionId?: string;
    traceId?: string;
    properties?: Record<string, unknown>;
  }) {
    return this.send("/requests", {
      method: input.method,
      path: input.path,
      status_code: input.statusCode,
      duration_ms: input.durationMs,
      user_id: input.userId,
      session_id: input.sessionId,
      trace_id: input.traceId,
      properties: input.properties ?? {},
    });
  }

  trackJob(input: {
    jobName: string;
    status: "started" | "completed" | "failed";
    durationMs?: number;
    errorMessage?: string;
    traceId?: string;
    properties?: Record<string, unknown>;
  }) {
    return this.send("/jobs", {
      job_name: input.jobName,
      status: input.status,
      duration_ms: input.durationMs,
      error_message: input.errorMessage,
      trace_id: input.traceId,
      properties: input.properties ?? {},
    });
  }

  trackWebhook(input: {
    webhookName: string;
    targetUrl: string;
    isSuccess: boolean;
    statusCode?: number;
    durationMs?: number;
    errorMessage?: string;
    traceId?: string;
    properties?: Record<string, unknown>;
  }) {
    return this.send("/webhooks", {
      webhook_name: input.webhookName,
      target_url: input.targetUrl,
      is_success: input.isSuccess,
      status_code: input.statusCode,
      duration_ms: input.durationMs,
      error_message: input.errorMessage,
      trace_id: input.traceId,
      properties: input.properties ?? {},
    });
  }

  expressMiddleware(options: { getUserId?: (req: ExpressRequest) => string | undefined } = {}) {
    return (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
      const started = performance.now();
      const incomingTraceId = headerValue(req.headers["x-trace-id"]);
      const traceId = incomingTraceId || this.createTraceId();
      res.setHeader("X-Trace-Id", traceId);

      res.on("finish", () => {
        void this.trackRequest({
          method: req.method,
          path: req.originalUrl ?? req.path ?? req.url ?? "/",
          statusCode: res.statusCode,
          durationMs: Math.round(performance.now() - started),
          traceId,
          userId: options.getUserId?.(req) ?? defaultUserId(req),
          properties: {
            ip: req.ip,
            user_agent: req.headers["user-agent"],
            host: req.headers.host,
          },
        });
      });

      next();
    };
  }

  expressErrorMiddleware(options: { getUserId?: (req: ExpressRequest) => string | undefined } = {}) {
    return (error: unknown, req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
      const traceId = String(res.getHeader("X-Trace-Id") ?? headerValue(req.headers["x-trace-id"]) ?? this.createTraceId());
      const errorStatus = extractHttpStatus(error);
      const capture = () => {
        void this.captureError(error, {
          traceId,
          userId: options.getUserId?.(req) ?? defaultUserId(req),
          properties: {
            method: req.method,
            path: req.originalUrl ?? req.path ?? req.url ?? "/",
            status: errorStatus ?? (res.statusCode >= 400 ? res.statusCode : 500),
          },
        });
      };

      if (res.writableEnded) {
        capture();
      } else {
        res.on("finish", capture);
      }
      next(error);
    };
  }

  installExpress(app: ExpressApp, options: { getUserId?: (req: ExpressRequest) => string | undefined } = {}) {
    const originalUse = app.use.bind(app);
    const errorMiddleware = this.expressErrorMiddleware(options);
    let errorMiddlewareInstalled = false;

    app.use = (...handlers: unknown[]) => {
      if (!errorMiddlewareInstalled && handlers.some(isExpressErrorHandler)) {
        errorMiddlewareInstalled = true;
        originalUse(errorMiddleware);
      }
      return originalUse(...handlers);
    };

    originalUse(this.expressMiddleware(options));
    return this;
  }

  async send(path: string, body: Record<string, unknown>) {
    if (!this.apiKey) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      await fetch(`${this.endpoint}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Observa-Key": this.apiKey,
        },
        body: JSON.stringify({ ...body, environment: this.environment }),
        signal: controller.signal,
      });
    } catch {
      // Observability must never break the host app.
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createObserva(input?: string | ObservaOptions) {
  return new ObservaNode(input);
}

export function instrumentExpress(
  app: ExpressApp,
  input?: string | ObservaOptions,
  options: { getUserId?: (req: ExpressRequest) => string | undefined } = {},
) {
  return createObserva(input).installExpress(app, options);
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function defaultUserId(req: ExpressRequest) {
  const id = req.user?.id;
  return id === undefined ? undefined : String(id);
}

function extractHttpStatus(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const candidate = (error as { statusCode?: unknown; status?: unknown }).statusCode ?? (error as { status?: unknown }).status;
  return typeof candidate === "number" && candidate >= 100 && candidate <= 599 ? candidate : undefined;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

function isExpressErrorHandler(value: unknown) {
  return typeof value === "function" && value.length === 4;
}

function createTraceId() {
  const runtime = globalThis as typeof globalThis & {
    crypto?: { randomUUID?: () => string };
  };
  return runtime.crypto?.randomUUID?.() ?? fallbackId();
}

function fallbackId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = char === "x" ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

function resolveEndpoint(endpoint: string | undefined, environment: string) {
  return (endpoint ?? defaultEndpoint(environment)).replace(/\/$/, "");
}

function defaultEndpoint(environment: string) {
  if (environment !== "production") return LOCAL_ENDPOINT;
  return HOSTED_ENDPOINT;
}
