type AutoTrackOptions = {
  pageViews?: boolean;
  errors?: boolean;
  fetch?: boolean;
  sessions?: boolean;
  presence?: boolean;
};

export { Observa } from "./react.js";

export type InitOptions = {
  apiKey: string;
  endpoint?: string;
  environment?: string;
  userId?: string;
  anonymousId?: string;
  autoTrack?: boolean | AutoTrackOptions;
};

type ResolvedConfig = Required<Omit<InitOptions, "userId" | "anonymousId" | "autoTrack">> &
  Pick<InitOptions, "userId" | "anonymousId"> & {
    autoTrack: Required<AutoTrackOptions>;
  };

const HOSTED_ENDPOINT = "https://observa-api.mutiurrahman.com/v1";
const LOCAL_ENDPOINT = "http://localhost:8000/v1";

let config: ResolvedConfig | null = null;
let currentUserId: string | null = null;
let anonymousId: string | null = null;
let sessionId: string | null = null;
let installed = false;
let nativeFetch: typeof fetch | null = null;
let presenceTimer: ReturnType<typeof setInterval> | undefined;

export function init(input: string | InitOptions) {
  if (!input) return;
  const options = typeof input === "string" ? { apiKey: input } : input;
  const environment = options.environment ?? defaultEnvironment();

  config = {
    endpoint: resolveEndpoint(options.endpoint, environment),
    environment,
    apiKey: options.apiKey,
    userId: options.userId,
    anonymousId: options.anonymousId,
    autoTrack: resolveAutoTrack(options.autoTrack),
  };

  currentUserId = options.userId ?? null;
  anonymousId = options.anonymousId ?? getAnonymousId();
  sessionId = getSessionId();

  if (!installed) {
    installed = true;
    if (config.autoTrack.pageViews) installPageViewTracking();
    if (config.autoTrack.errors) installGlobalErrorHandlers();
    if (config.autoTrack.fetch) installFetchTracking();
    if (config.autoTrack.sessions) installSessionTracking();
    if (config.autoTrack.presence) installPresenceTracking();
  }

  if (config.autoTrack.pageViews) void capturePageView();
  if (config.autoTrack.sessions) void trackSession("start");
  if (config.autoTrack.presence) void trackPresence();
}

export function identify(userId: string | null) {
  currentUserId = userId;
  if (config?.autoTrack.presence) void trackPresence();
}

export function track(
  eventName: string,
  properties: Record<string, unknown> = {},
  options: { traceId?: string; sessionId?: string } = {},
) {
  return send("/events", {
    event_type: "custom_event",
    event_name: eventName,
    user_id: currentUserId,
    anonymous_id: anonymousId,
    trace_id: options.traceId,
    session_id: options.sessionId ?? sessionId,
    properties,
  });
}

export function capturePageView(properties: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return Promise.resolve();
  return send("/events", {
    event_type: "page_view",
    event_name: window.location.pathname,
    user_id: currentUserId,
    anonymous_id: anonymousId,
    session_id: sessionId,
    properties: {
      path: window.location.pathname,
      title: document.title,
      referrer: document.referrer,
      url: window.location.href,
      ...properties,
    },
  });
}

export function captureError(
  error: unknown,
  properties: Record<string, unknown> = {},
  options: { traceId?: string; sessionId?: string } = {},
) {
  const normalized = normalizeError(error);
  return send("/errors", {
    error_type: normalized.name,
    message: normalized.message,
    stack_trace: normalized.stack,
    source: "frontend",
    user_id: currentUserId,
    session_id: options.sessionId ?? sessionId,
    trace_id: options.traceId,
    properties,
  });
}

export function createTraceId() {
  return crypto.randomUUID();
}

async function send(path: string, body: Record<string, unknown>) {
  if (!config || typeof fetch === "undefined") return;
  try {
    await (nativeFetch ?? fetch)(`${config.endpoint}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...body,
        api_key: config.apiKey,
        environment: config.environment,
      }),
      keepalive: true,
    });
  } catch {
    // Observability must never break the host app.
  }
}

function resolveAutoTrack(input: boolean | AutoTrackOptions | undefined): Required<AutoTrackOptions> {
  if (input === false) {
    return { pageViews: false, errors: false, fetch: false, sessions: false, presence: false };
  }
  const partial = typeof input === "object" ? input : {};
  return {
    pageViews: partial.pageViews ?? true,
    errors: partial.errors ?? true,
    fetch: partial.fetch ?? false,
    sessions: partial.sessions ?? true,
    presence: partial.presence ?? true,
  };
}

function getAnonymousId() {
  if (typeof window === "undefined") return null;
  const key = "observa_anonymous_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

function getSessionId() {
  if (typeof window === "undefined") return null;
  const key = "observa_session_id";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}

function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (event) => {
    void captureError(event.error instanceof Error ? event.error : new Error(event.message), {
      path: window.location.pathname,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    void captureError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)), {
      path: window.location.pathname,
    });
  });
}

function installPageViewTracking() {
  if (typeof window === "undefined") return;
  const emit = debounce(() => {
    void capturePageView();
    if (config?.autoTrack.presence) void trackPresence();
  }, 0);
  const pushState = window.history.pushState;
  const replaceState = window.history.replaceState;

  window.history.pushState = function (...args) {
    const result = pushState.apply(this, args);
    emit();
    return result;
  };

  window.history.replaceState = function (...args) {
    const result = replaceState.apply(this, args);
    emit();
    return result;
  };

  window.addEventListener("popstate", emit);
}

function installFetchTracking() {
  if (typeof window === "undefined" || typeof window.fetch === "undefined") return;
  nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = getFetchUrl(input);
    if (isObservaRequest(requestUrl)) {
      return nativeFetch!(input, init);
    }

    const traceId = createTraceId();
    const started = performance.now();
    const request = withTraceHeader(input, init, traceId, shouldPropagateTrace(requestUrl));

    try {
      const response = await nativeFetch!(request.input, request.init);
      void trackRequest({
        method: request.method,
        url: requestUrl,
        statusCode: response.status,
        durationMs: Math.round(performance.now() - started),
        traceId,
      });
      return response;
    } catch (error) {
      void captureError(error, { url: requestUrl, method: request.method }, { traceId });
      throw error;
    }
  };
}

function installSessionTracking() {
  if (typeof window === "undefined") return;
  window.addEventListener("pagehide", () => {
    void trackSession("end");
  });
}

function installPresenceTracking() {
  if (typeof window === "undefined") return;
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = setInterval(() => void trackPresence(), 20_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void trackPresence();
  });
}

function trackPresence() {
  if (typeof window === "undefined" || document.visibilityState === "hidden" || !sessionId || !anonymousId) {
    return Promise.resolve();
  }
  return send("/presence", {
    user_id: currentUserId,
    anonymous_id: anonymousId,
    session_id: sessionId,
    path: window.location.pathname,
    url: window.location.href,
    title: document.title,
  });
}

function trackSession(action: "start" | "end") {
  if (!sessionId) return Promise.resolve();
  return send("/sessions", {
    session_id: sessionId,
    action,
    user_id: currentUserId,
    anonymous_id: anonymousId,
    properties: {
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
    },
  });
}

function trackRequest(input: {
  method: string;
  url: string;
  statusCode: number;
  durationMs: number;
  traceId: string;
}) {
  return send("/requests", {
    method: input.method,
    path: safePath(input.url),
    status_code: input.statusCode,
    duration_ms: input.durationMs,
    user_id: currentUserId,
    session_id: sessionId,
    trace_id: input.traceId,
    properties: { url: input.url },
  });
}

function withTraceHeader(input: RequestInfo | URL, init: RequestInit | undefined, traceId: string, shouldPropagate: boolean) {
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (shouldPropagate && !headers.has("X-Trace-Id")) headers.set("X-Trace-Id", traceId);

  if (input instanceof Request) {
    return {
      input: new Request(input, { ...init, headers }),
      init: undefined,
      method,
    };
  }

  return {
    input,
    init: { ...init, headers },
    method,
  };
}

function getFetchUrl(input: RequestInfo | URL) {
  if (input instanceof Request) return input.url;
  return String(input);
}

function isObservaRequest(url: string) {
  return !!config && url.startsWith(config.endpoint);
}

function safePath(url: string) {
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.href : undefined);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function shouldPropagateTrace(url: string) {
  if (typeof window === "undefined") return false;
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

function normalizeError(error: unknown) {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

function debounce(fn: () => void, timeout: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, timeout);
  };
}

function resolveEndpoint(endpoint: string | undefined, environment: string) {
  return (endpoint ?? defaultEndpoint(environment)).replace(/\/$/, "");
}

function defaultEndpoint(environment: string) {
  if (environment !== "production" || isDevelopmentRuntime()) return LOCAL_ENDPOINT;
  return HOSTED_ENDPOINT;
}

function isLocalDevelopmentHost() {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  return isLocalHostname(hostname) || isPrivateIpv4(hostname) || isLikelyDevPort(window.location.port);
}

function defaultEnvironment() {
  return isDevelopmentRuntime() ? "development" : "production";
}

function isDevelopmentRuntime() {
  return isLocalDevelopmentHost() || isBundlerDevelopment();
}

function isBundlerDevelopment() {
  const env = (import.meta as ImportMeta & {
    env?: { DEV?: boolean; MODE?: string };
  }).env;

  return env?.DEV === true || env?.MODE === "development";
}

function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".test")
  );
}

function isPrivateIpv4(hostname: string) {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;

  const [a, b, c, d] = match.slice(1).map(Number);
  if ([a, b, c, d].some((part) => part < 0 || part > 255)) return false;

  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

function isLikelyDevPort(port: string) {
  return ["3000", "3001", "3002", "4173", "5173", "5174", "5175", "5176", "5177", "8080"].includes(port);
}
