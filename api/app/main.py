from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.errors import DomainError

app = FastAPI(title="UGC Campaigns API")
app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"]
)


@app.exception_handler(DomainError)
def handle_domain_error(request: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.get("/health")
def health():
    return {"ok": True}


from app.routers import applications, auth, campaigns, notifications, wallet  # noqa: E402

for router in (auth.router, campaigns.router, applications.router, wallet.router, notifications.router):
    app.include_router(router)
