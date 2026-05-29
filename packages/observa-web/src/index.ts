type InitOptions = {
  apiKey: string;
  endpoint?: string;
  environment?: string;
};

let config: Required<InitOptions> | null = null;
let currentUserId: string | null = null;

export function init(options: InitOptions) {
  config = {
    endpoint: options.endpoint ?? "http://localhost:8000/v1",
    environment: options.environment ?? "production",
    apiKey: options.apiKey,
  };
}

export function identify(userId: string) {
  currentUserId = userId;
}

export function track(eventName: string, properties: Record<string, unknown> = {}) {
  return send("/events", {
    event_type: "custom_event",
    event_name: eventName,
    user_id: currentUserId,
    properties,
  });
}

export function captureError(error: Error, properties: Record<string, unknown> = {}) {
  return send("/errors", {
    error_type: error.name,
    message: error.message,
    stack_trace: error.stack,
    source: "frontend",
    user_id: currentUserId,
    properties,
  });
}

async function send(path: string, body: Record<string, unknown>) {
  if (!config) throw new Error("Observa not initialized");
  await fetch(`${config.endpoint}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Observa-Key": config.apiKey,
    },
    body: JSON.stringify({ ...body, environment: config.environment }),
    keepalive: true,
  });
}
