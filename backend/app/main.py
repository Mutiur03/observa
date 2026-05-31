from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from observa import ObservaClient

from app.api.routes import auth, dashboard, ingestion, monitoring, projects
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if settings.observa_api_key:
    observa = ObservaClient(api_key=settings.observa_api_key, endpoint=settings.observa_endpoint)
    app.middleware("http")(
        observa.fastapi_middleware(
            exclude_path_prefixes=("/v1",),
            properties={"source": "observa_backend"},
        )
    )


@app.middleware("http")
async def ingestion_cors(request, call_next):
    if request.url.path.startswith("/v1"):
        if request.method == "OPTIONS":
            headers = {
                "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": request.headers.get(
                    "access-control-request-headers",
                    "Content-Type, X-Observa-Key, Authorization",
                ),
                "Access-Control-Max-Age": "86400",
                "Vary": "Origin",
            }
            return Response(status_code=204, headers=headers)

        response = await call_next(request)
        response.headers["Access-Control-Allow-Origin"] = request.headers.get("origin", "*")
        response.headers["Vary"] = "Origin"
        return response

    return await call_next(request)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(ingestion.router)
app.include_router(dashboard.router)
app.include_router(monitoring.router)


@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
