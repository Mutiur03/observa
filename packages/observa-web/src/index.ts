type AutoTrackOptions = {
  pageViews?: boolean;
  errors?: boolean;
  fetch?: boolean;
  sessions?: boolean;
  presence?: boolean;
  webVitals?: boolean;
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
let lastTrackedPageUrl: string | null = null;

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
    if (config.autoTrack.webVitals) installWebVitalsTracking();
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
  const pageUrl = window.location.href;
  if (pageUrl === lastTrackedPageUrl) return Promise.resolve();
  lastTrackedPageUrl = pageUrl;
  const currentUrl = new URL(window.location.href);
  const referrerUrl = parseUrl(document.referrer);
  const bot = detectBot();
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
      referrer_host: referrerUrl?.host || "Direct",
      url: window.location.href,
      host: currentUrl.host,
      utm_source: currentUrl.searchParams.get("utm_source") || undefined,
      utm_medium: currentUrl.searchParams.get("utm_medium") || undefined,
      utm_campaign: currentUrl.searchParams.get("utm_campaign") || undefined,
      traffic_channel: classifyTrafficChannel(currentUrl, referrerUrl),
      browser: detectBrowser(),
      os: detectOs(),
      device_type: detectDeviceType(),
      user_agent: navigator.userAgent,
      is_bot: bot.isBot,
      bot_name: bot.name,
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
    return { pageViews: false, errors: false, fetch: false, sessions: false, presence: false, webVitals: false };
  }
  const partial = typeof input === "object" ? input : {};
  return {
    pageViews: partial.pageViews ?? true,
    errors: partial.errors ?? true,
    fetch: partial.fetch ?? false,
    sessions: partial.sessions ?? true,
    presence: partial.presence ?? true,
    webVitals: partial.webVitals ?? false,
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
  const navigation = (window as Window & { navigation?: EventTarget }).navigation;

  if (navigation) {
    navigation.addEventListener("currententrychange", emit);
    window.addEventListener("hashchange", emit);
    return;
  }

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
  window.addEventListener("hashchange", emit);
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

function installWebVitalsTracking() {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;
  observeLargestContentfulPaint();
  observeCumulativeLayoutShift();
  reportNavigationTiming();
}

function reportWebVital(name: string, value: number, rating: "good" | "needs-improvement" | "poor") {
  if (!Number.isFinite(value) || value < 0) return;
  void track("web_vital", {
    name,
    value: Math.round(value * 100) / 100,
    rating,
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
  });
}

function observeLargestContentfulPaint() {
  let lcp = 0;
  let reported = false;
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const entry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };
      lcp = entry.renderTime || entry.loadTime || entry.startTime;
    });
    observer.observe({ type: "largest-contentful-paint", buffered: true });
    reportWhenPageHides(() => {
      if (reported || !lcp) return;
      reported = true;
      observer.disconnect();
      reportWebVital("LCP", lcp, rateLcp(lcp));
    });
  } catch {
    // Some browsers do not support this metric.
  }
}

function observeCumulativeLayoutShift() {
  let cls = 0;
  let reported = false;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
        if (!entry.hadRecentInput) cls += entry.value ?? 0;
      }
    });
    observer.observe({ type: "layout-shift", buffered: true });
    reportWhenPageHides(() => {
      if (reported) return;
      reported = true;
      observer.disconnect();
      reportWebVital("CLS", cls, rateCls(cls));
    });
  } catch {
    // Some browsers do not support this metric.
  }
}

function reportWhenPageHides(report: () => void) {
  let reported = false;
  const flush = () => {
    if (reported) return;
    reported = true;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", flush);
    report();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") flush();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", flush);
}

function reportNavigationTiming() {
  const report = () => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (!navigation) return;
    reportWebVital("TTFB", navigation.responseStart - navigation.requestStart, rateTtfb(navigation.responseStart - navigation.requestStart));
    if (navigation.loadEventEnd > 0) {
      reportWebVital("Page Load", navigation.loadEventEnd - navigation.startTime, ratePageLoad(navigation.loadEventEnd - navigation.startTime));
    }
  };

  if (document.readyState === "complete") report();
  else window.addEventListener("load", () => setTimeout(report, 0), { once: true });
}

function parseUrl(value: string) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function detectDeviceType() {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (/ipad|tablet|playbook|silk/i.test(ua)) return "Tablet";
  if (/mobile|iphone|ipod|android.*mobile|blackberry|iemobile/i.test(ua)) return "Mobile";
  return "Desktop";
}

function detectBot() {
  if (typeof navigator === "undefined") return { isBot: false, name: undefined };
  const ua = navigator.userAgent.toLowerCase();
  const patterns = [
    ["Googlebot", /googlebot/],
    ["Bingbot", /bingbot/],
    ["DuckDuckBot", /duckduckbot/],
    ["YandexBot", /yandexbot/],
    ["Baiduspider", /baiduspider/],
    ["FacebookBot", /facebookexternalhit|facebot/],
    ["TwitterBot", /twitterbot/],
    ["LinkedInBot", /linkedinbot/],
    ["Generic Bot", /bot|crawler|spider|crawling|slurp|preview/],
  ] as const;

  const match = patterns.find(([, pattern]) => pattern.test(ua));
  return { isBot: Boolean(match), name: match?.[0] };
}

function classifyTrafficChannel(currentUrl: URL, referrerUrl: URL | null) {
  const source = currentUrl.searchParams.get("utm_source")?.toLowerCase() ?? "";
  const medium = currentUrl.searchParams.get("utm_medium")?.toLowerCase() ?? "";
  const referrerHost = referrerUrl?.hostname.toLowerCase() ?? "";

  if (["cpc", "ppc", "paid", "paid_social", "display", "ad", "ads"].some((value) => medium.includes(value))) return "Paid";
  if (medium.includes("email") || source.includes("newsletter")) return "Email";
  if (isSocialHost(source) || isSocialHost(referrerHost) || medium.includes("social")) return "Social";
  if (isSearchHost(referrerHost) || medium.includes("organic")) return "Organic Search";
  if (!referrerHost) return "Direct";
  if (referrerHost === currentUrl.hostname.toLowerCase()) return "Internal";
  return "Referral";
}

function isSearchHost(value: string) {
  return /(^|\.)google\.|(^|\.)bing\.|(^|\.)yahoo\.|(^|\.)duckduckgo\.|(^|\.)baidu\.|(^|\.)yandex\./.test(value);
}

function isSocialHost(value: string) {
  return /facebook|instagram|twitter|x\.com|linkedin|tiktok|pinterest|reddit|youtube/.test(value);
}

function detectBrowser() {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\//i.test(ua)) return "Opera";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/safari\//i.test(ua) && !/chrome|chromium|crios/i.test(ua)) return "Safari";
  if (/chrome|chromium|crios/i.test(ua)) return "Chrome";
  return "Other";
}

function detectOs() {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (/windows/i.test(ua)) return "Windows";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
}

function rateLcp(value: number) {
  if (value <= 2500) return "good";
  if (value <= 4000) return "needs-improvement";
  return "poor";
}

function rateCls(value: number) {
  if (value <= 0.1) return "good";
  if (value <= 0.25) return "needs-improvement";
  return "poor";
}

function rateTtfb(value: number) {
  if (value <= 800) return "good";
  if (value <= 1800) return "needs-improvement";
  return "poor";
}

function ratePageLoad(value: number) {
  if (value <= 3000) return "good";
  if (value <= 6000) return "needs-improvement";
  return "poor";
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
