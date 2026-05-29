from __future__ import annotations

from collections.abc import Callable
from time import perf_counter
from typing import Any
from uuid import uuid4

import httpx


class ObservaClient:
    def __init__(self, api_key: str, endpoint: str = "http://localhost:8000/v1", environment: str = "production"):
        self.api_key = api_key
        self.endpoint = endpoint.rstrip("/")
        self.environment = environment

    def track(
        self,
        event_name: str,
        properties: dict[str, Any] | None = None,
        user_id: str | None = None,
        trace_id: str | None = None,
        session_id: str | None = None,
    ) -> None:
        self._post(
            "/events",
            {
                "event_type": "custom_event",
                "event_name": event_name,
                "user_id": user_id,
                "trace_id": trace_id,
                "session_id": session_id,
                "properties": properties or {},
                "environment": self.environment,
            },
        )

    def capture_exception(
        self,
        exc: Exception,
        properties: dict[str, Any] | None = None,
        trace_id: str | None = None,
        session_id: str | None = None,
    ) -> None:
        self._post(
            "/errors",
            {
                "error_type": exc.__class__.__name__,
                "message": str(exc),
                "source": "backend",
                "trace_id": trace_id,
                "session_id": session_id,
                "properties": properties or {},
            },
        )

    def track_request(
        self,
        method: str,
        path: str,
        status_code: int,
        duration_ms: int,
        trace_id: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
        properties: dict[str, Any] | None = None,
    ) -> None:
        self._post(
            "/requests",
            {
                "method": method,
                "path": path,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "trace_id": trace_id,
                "user_id": user_id,
                "session_id": session_id,
                "properties": properties or {},
            },
        )

    def track_job(
        self,
        job_name: str,
        status: str,
        duration_ms: int | None = None,
        error_message: str | None = None,
        trace_id: str | None = None,
        properties: dict[str, Any] | None = None,
    ) -> None:
        self._post(
            "/jobs",
            {
                "job_name": job_name,
                "status": status,
                "duration_ms": duration_ms,
                "error_message": error_message,
                "trace_id": trace_id,
                "properties": properties or {},
            },
        )

    def track_webhook(
        self,
        webhook_name: str,
        target_url: str,
        is_success: bool,
        status_code: int | None = None,
        duration_ms: int | None = None,
        error_message: str | None = None,
        trace_id: str | None = None,
        properties: dict[str, Any] | None = None,
    ) -> None:
        self._post(
            "/webhooks",
            {
                "webhook_name": webhook_name,
                "target_url": target_url,
                "is_success": is_success,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "error_message": error_message,
                "trace_id": trace_id,
                "properties": properties or {},
            },
        )

    def fastapi_middleware(self) -> Callable:
        client = self

        async def middleware(request, call_next):
            trace_id = request.headers.get("X-Trace-Id") or str(uuid4())
            started = perf_counter()
            try:
                response = await call_next(request)
                duration_ms = int((perf_counter() - started) * 1000)
                client.track_request(
                    method=request.method,
                    path=request.url.path,
                    status_code=response.status_code,
                    duration_ms=duration_ms,
                    trace_id=trace_id,
                )
                response.headers["X-Trace-Id"] = trace_id
                return response
            except Exception as exc:
                client.capture_exception(
                    exc,
                    properties={"method": request.method, "path": request.url.path},
                    trace_id=trace_id,
                )
                raise

        return middleware

    def _post(self, path: str, payload: dict[str, Any]) -> None:
        httpx.post(
            f"{self.endpoint}{path}",
            json=payload,
            headers={"X-Observa-Key": self.api_key},
            timeout=3,
        ).raise_for_status()
