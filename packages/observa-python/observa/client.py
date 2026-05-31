from __future__ import annotations

import asyncio
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

    def fastapi_middleware(
        self,
        exclude_path_prefixes: tuple[str, ...] = (),
        properties: dict[str, Any] | None = None,
    ) -> Callable:
        client = self

        async def middleware(request, call_next):
            if request.url.path.startswith(exclude_path_prefixes):
                return await call_next(request)

            trace_id = request.headers.get("X-Trace-Id") or str(uuid4())
            request_properties = _request_properties(request, properties)
            started = perf_counter()
            try:
                response = await call_next(request)
                duration_ms = int((perf_counter() - started) * 1000)
                asyncio.create_task(
                    _run_safely(
                        client.track_request,
                        method=request.method,
                        path=_request_path(request),
                        status_code=response.status_code,
                        duration_ms=duration_ms,
                        trace_id=trace_id,
                        properties=request_properties,
                    )
                )
                response.headers["X-Trace-Id"] = trace_id
                return response
            except Exception as exc:
                asyncio.create_task(
                    _run_safely(
                        client.capture_exception,
                        exc,
                        properties={"method": request.method, "path": _request_path(request), **request_properties},
                        trace_id=trace_id,
                    )
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


def _request_path(request) -> str:
    query = request.url.query
    return f"{request.url.path}?{query}" if query else request.url.path


def _request_properties(request, properties: dict[str, Any] | None) -> dict[str, Any]:
    client_ip = request.headers.get("X-Forwarded-For", "").split(",", 1)[0].strip()
    if not client_ip and request.client:
        client_ip = request.client.host

    source = request.headers.get("Origin") or request.headers.get("Referer") or client_ip or "unknown"
    return {
        **(properties or {}),
        "source": source,
        "client_ip": client_ip or None,
        "user_agent": request.headers.get("User-Agent"),
    }


async def _run_safely(function: Callable, *args, **kwargs) -> None:
    try:
        await asyncio.to_thread(function, *args, **kwargs)
    except Exception:
        # Observability must never break or add noise to the host app.
        pass
