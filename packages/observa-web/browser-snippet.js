(function () {
  var config = null;
  var userId = null;
  var anonymousId = getOrCreate("localStorage", "observa_anonymous_id");
  var sessionId = getOrCreate("sessionStorage", "observa_session_id");
  var nativeFetch = window.fetch && window.fetch.bind(window);
  var installed = false;

  function init(input) {
    var options = typeof input === "string" ? { apiKey: input } : input;
    var environment = options.environment || defaultEnvironment();
    config = {
      apiKey: options.apiKey,
      endpoint: resolveEndpoint(options.endpoint, environment),
      environment: environment,
    };
    userId = options.userId || null;
    if (!installed) {
      installed = true;
      installPageViews();
      installErrors();
      installSessions();
    }
    pageView();
    session("start");
  }

  function send(path, body) {
    if (!config || !nativeFetch) return;
    nativeFetch(config.endpoint + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(Object.assign({ api_key: config.apiKey, environment: config.environment }, body)),
      keepalive: true,
    }).catch(function () {});
  }

  function pageView() {
    send("/events", {
      event_type: "page_view",
      event_name: location.pathname,
      user_id: userId,
      anonymous_id: anonymousId,
      session_id: sessionId,
      properties: { path: location.pathname, title: document.title, referrer: document.referrer, url: location.href },
    });
  }

  function session(action) {
    send("/sessions", {
      session_id: sessionId,
      action: action,
      user_id: userId,
      anonymous_id: anonymousId,
      properties: { path: location.pathname },
    });
  }

  function captureError(error, properties, options) {
    send("/errors", {
      error_type: error.name || "Error",
      message: error.message || String(error),
      stack_trace: error.stack,
      source: "frontend",
      user_id: userId,
      anonymous_id: anonymousId,
      session_id: (options && options.sessionId) || sessionId,
      trace_id: options && options.traceId,
      properties: properties || {},
    });
  }

  function installPageViews() {
    var pushState = history.pushState;
    var replaceState = history.replaceState;
    history.pushState = function () {
      var result = pushState.apply(this, arguments);
      setTimeout(pageView, 0);
      return result;
    };
    history.replaceState = function () {
      var result = replaceState.apply(this, arguments);
      setTimeout(pageView, 0);
      return result;
    };
    window.addEventListener("popstate", pageView);
  }

  function installErrors() {
    window.addEventListener("error", function (event) {
      captureError(event.error || new Error(event.message), { path: location.pathname });
    });
    window.addEventListener("unhandledrejection", function (event) {
      captureError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)), { path: location.pathname });
    });
  }

  function installFetch() {
    if (!nativeFetch) return;
    window.fetch = function (input, init) {
      var url = input && input.url ? input.url : String(input);
      if (config && url.indexOf(config.endpoint) === 0) return nativeFetch(input, init);

      var traceId = crypto.randomUUID();
      var started = performance.now();
      var headers = new Headers((init && init.headers) || (input && input.headers) || undefined);
      if (shouldPropagateTrace(url) && !headers.has("X-Trace-Id")) headers.set("X-Trace-Id", traceId);
      var nextInit = Object.assign({}, init || {}, { headers: headers });
      var method = nextInit.method || (input && input.method) || "GET";

      return nativeFetch(input, nextInit).then(function (response) {
        send("/requests", {
          method: method,
          path: pathFromUrl(url),
          status_code: response.status,
          duration_ms: Math.round(performance.now() - started),
          trace_id: traceId,
          user_id: userId,
          session_id: sessionId,
          properties: { url: url },
        });
        return response;
      }).catch(function (error) {
        captureError(error, { url: url, method: method }, { traceId: traceId });
        throw error;
      });
    };
  }

  function installSessions() {
    window.addEventListener("pagehide", function () {
      session("end");
    });
  }

  function pathFromUrl(url) {
    try {
      var parsed = new URL(url, location.href);
      return parsed.pathname + parsed.search;
    } catch (_) {
      return url;
    }
  }

  function shouldPropagateTrace(url) {
    try {
      return new URL(url, location.href).origin === location.origin;
    } catch (_) {
      return false;
    }
  }

  function getOrCreate(storageName, key) {
    var storage = window[storageName];
    var existing = storage.getItem(key);
    if (existing) return existing;
    var created = crypto.randomUUID();
    storage.setItem(key, created);
    return created;
  }

  function resolveEndpoint(endpoint, environment) {
    return (endpoint || defaultEndpoint(environment)).replace(/\/$/, "");
  }

  function defaultEndpoint(environment) {
    if (environment !== "production" || isLocalDevelopmentHost()) return "http://localhost:8000/v1";
    return "https://api.observa.dev/v1";
  }

  function isLocalDevelopmentHost() {
    var hostname = location.hostname.toLowerCase();
    return isLocalHostname(hostname) || isPrivateIpv4(hostname) || isLikelyDevPort(location.port);
  }

  function defaultEnvironment() {
    return isLocalDevelopmentHost() ? "development" : "production";
  }

  function isLocalHostname(hostname) {
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.slice(-10) === ".localhost" ||
      hostname.slice(-6) === ".local" ||
      hostname.slice(-5) === ".test"
    );
  }

  function isPrivateIpv4(hostname) {
    var match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!match) return false;

    var a = Number(match[1]);
    var b = Number(match[2]);
    var c = Number(match[3]);
    var d = Number(match[4]);
    if ([a, b, c, d].some(function (part) { return part < 0 || part > 255; })) return false;

    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
  }

  function isLikelyDevPort(port) {
    return ["3000", "3001", "3002", "4173", "5173", "5174", "5175", "5176", "5177", "8080"].indexOf(port) !== -1;
  }

  window.Observa = {
    init: init,
    identify: function (id) { userId = id; },
    track: function (eventName, properties, options) {
      send("/events", {
        event_type: "custom_event",
        event_name: eventName,
        user_id: userId,
        anonymous_id: anonymousId,
        session_id: (options && options.sessionId) || sessionId,
        trace_id: options && options.traceId,
        properties: properties || {},
      });
    },
    captureError: captureError,
    traceId: function () { return crypto.randomUUID(); },
  };
})();
