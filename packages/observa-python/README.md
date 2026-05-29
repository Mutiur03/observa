# observa-python

Local Python SDK for Observa.

## Local install

```bash
pip install -e ../packages/observa-python
```

## FastAPI

```python
from fastapi import FastAPI
from observa import ObservaClient

app = FastAPI()
observa = ObservaClient(
    api_key="obssk_YOUR_SECRET_KEY",
    endpoint="http://localhost:8000/v1",
    environment="production",
)

app.middleware("http")(observa.fastapi_middleware())
```

## Manual Events

```python
trace_id = "trace_123"

observa.track("checkout_started", {"plan": "pro"}, user_id="user_123", trace_id=trace_id)

try:
    raise RuntimeError("Example")
except Exception as exc:
    observa.capture_exception(exc, trace_id=trace_id)
```
