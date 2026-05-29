from __future__ import annotations

from collections.abc import Callable
from time import perf_counter
from typing import Any

import httpx


class ObservaClient:
    def __init__(self, api_key: str, endpoint: str = "http://localhost:8000/v1", environment: str = "production"):
        self.api_key = api_key
        self.endpoint = endpoint.rstrip("/")
        self.environment = environment

    def track(self, event_name: str, properties: dict[str, Any] | None = None, user_id: str | None = None) -> None:
        self._post(
            "/events",
            {
                "event_type": "custom_event",
                "event_name": event_name,
                "user_id": user_id,
                "properties": properties or {},
                "environment": self.environment,
            },
        )

    def capture_exception(self, exc: Exception, properties: dict[str, Any] | None = None) -> None:
        self._post(
            "/errors",
            {
                "error_type": exc.__class__.__name__,
                "message": str(exc),
                "source": "backend",
                "properties": properties or {},
            },
        )

    def fastapi_middleware(self) -> Callable:
        client = self

        async def middleware(request, call_next):
            started = perf_counter()
            response = await call_next(request)
            client._post(
                "/requests",
                {
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": int((perf_counter() - started) * 1000),
                },
            )
            return response

        return middleware

    def _post(self, path: str, payload: dict[str, Any]) -> None:
        httpx.post(
            f"{self.endpoint}{path}",
            json=payload,
            headers={"X-Observa-Key": self.api_key},
            timeout=3,
        ).raise_for_status()
