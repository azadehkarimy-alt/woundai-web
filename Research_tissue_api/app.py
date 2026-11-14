"""Research-only WoundAI tissue API with Supabase-authenticated access."""
from __future__ import annotations

import os
import time
import threading
from collections import defaultdict, deque
from io import BytesIO

import httpx
from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps

from model_adapter import model_status, ModelNotConfigured, InvalidModelOutput, predict_tissue

app = FastAPI(title="WoundAI Tissue Research API", version="0.5.0")

_default_origins = [
    "http://localhost:5500", "http://127.0.0.1:5500",
    "http://localhost:8000", "http://127.0.0.1:8000",
]
_allowed_origins = [
    x.strip().rstrip("/") for x in
    os.getenv("WOUNDAI_ALLOWED_ORIGINS", ",".join(_default_origins)).split(",")
    if x.strip()
]
# No wildcard/regex origins. Production origins must be explicitly configured.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type", "Authorization"],
    max_age=600,
)

CLASSES = {
    0: "unclassified", 1: "granulation", 2: "slough",
    3: "necrosis", 4: "other", 255: "outside_wound"
}
MAX_UPLOAD_BYTES = 15_000_000
MAX_PIXELS = 16_000_000

# Per-process limiter. Deployments with multiple workers must also apply a
# shared gateway/API-gateway rate limit; this local limiter is defense in depth.
_rate_lock = threading.Lock()
_rate_events: dict[str, deque] = defaultdict(deque)


def _rate_limit(request: Request):
    limit = max(1, int(os.getenv("WOUNDAI_API_REQUESTS_PER_MINUTE", "12")))
    window = 60.0
    host = request.client.host if request.client else "unknown"
    key = f"{host}:{request.url.path}"
    now = time.monotonic()
    with _rate_lock:
        events = _rate_events[key]
        while events and now - events[0] >= window:
            events.popleft()
        if len(events) >= limit:
            raise HTTPException(
                status_code=429,
                detail="درخواست‌های بیش از حد مجاز؛ کمی بعد دوباره تلاش کنید.",
                headers={"Retry-After": "60"},
            )
        events.append(now)


async def require_authenticated_user(request: Request):
    """Validate the Supabase access token with Supabase Auth; fail closed."""
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip() or len(token) > 8192:
        raise HTTPException(status_code=401, detail="احراز هویت لازم است.")
    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    publishable_key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()
    if not supabase_url or not publishable_key:
        raise HTTPException(
            status_code=503,
            detail="احراز هویت سرور پیکربندی نشده است؛ endpoint بسته باقی می‌ماند.",
        )
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "apikey": publishable_key,
                    "Authorization": f"Bearer {token.strip()}",
                    "Accept": "application/json",
                },
            )
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="سرویس احراز هویت در دسترس نیست.")
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="نشست کاربر معتبر یا فعال نیست.")
    try:
        user = response.json()
    except ValueError:
        raise HTTPException(status_code=503, detail="پاسخ سرویس احراز هویت معتبر نیست.")
    if not isinstance(user, dict) or not user.get("id"):
        raise HTTPException(status_code=401, detail="هویت کاربر تأیید نشد.")
    # Return only the non-sensitive identifier; never log token/email/PHI.
    return {"user_id": str(user["id"])}


def _sanitize_image(raw: bytes) -> bytes:
    """Decode and re-encode the image, dropping EXIF and other metadata."""
    try:
        with Image.open(BytesIO(raw)) as source:
            source_format = source.format
            if source_format not in {"PNG", "JPEG", "WEBP"}:
                raise ValueError("Only PNG, JPEG and WEBP images are accepted")
            if source.width * source.height > MAX_PIXELS:
                raise ValueError("Image exceeds 16 megapixels")
            source.load()
            image = ImageOps.exif_transpose(source)
            if source_format == "JPEG":
                if image.mode not in {"RGB", "L"}:
                    image = image.convert("RGB")
            elif source_format == "PNG":
                if image.mode not in {"RGB", "RGBA", "L", "LA"}:
                    image = image.convert("RGBA")
            elif source_format == "WEBP":
                if image.mode not in {"RGB", "RGBA"}:
                    image = image.convert("RGB")
            output = BytesIO()
            if source_format == "JPEG":
                image.save(output, format="JPEG", quality=95, optimize=True)
            elif source_format == "WEBP":
                image.save(output, format="WEBP", quality=95, method=4)
            else:
                image.save(output, format="PNG", optimize=True)
            return output.getvalue()
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"تصویر معتبر یا قابل پردازش نیست: {type(exc).__name__}",
        )


@app.get("/health")
def health():
    status = model_status()
    return {
        "status": "ok",
        "model": status.get("model"),
        "model_version": status.get("model_version"),
        "model_loaded": bool(status.get("inference_ready")),
        "checkpoint_configured": bool(status.get("checkpoint_configured")),
        "checkpoint_exists": bool(status.get("checkpoint_exists")),
        "checkpoint_verified": bool(status.get("checkpoint_verified")),
        "model_card_id": status.get("model_card_id"),
        "training_domain": status.get("training_domain"),
        "license": status.get("license"),
        "clinical_use": False,
        "authentication_required": True,
        "reason": status.get("reason"),
    }


@app.post("/v1/tissue/analyze")
async def analyze(
    request: Request,
    image: UploadFile = File(...),
    user=Depends(require_authenticated_user),
    _limit=Depends(_rate_limit),
):
    # The user ID is deliberately not persisted with the image in this prototype.
    # Production audit integration must link the request to a clinic and consent record.
    raw = await image.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Image exceeds 15 MB")
    sanitized = _sanitize_image(raw)
    try:
        return predict_tissue(sanitized)
    except ModelNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except InvalidModelOutput as exc:
        raise HTTPException(status_code=502, detail=f"Model output rejected: {exc}")


@app.post("/v1/tissue/quantify-mask")
async def quantify_mask(
    request: Request,
    mask: UploadFile = File(...),
    user=Depends(require_authenticated_user),
    _limit=Depends(_rate_limit),
):
    """Counts pixels in a manually labeled mask; NOT image recognition."""
    raw = await mask.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Mask exceeds 15 MB")
    try:
        with Image.open(BytesIO(raw)) as source:
            if source.format != "PNG" or source.mode != "L":
                raise ValueError("Mask must be an 8-bit grayscale PNG")
            if source.width * source.height > MAX_PIXELS:
                raise ValueError("Mask too large")
            source.load()
            counts = {value: count for value, count in enumerate(source.histogram()) if count}
    except Exception as exc:
        raise HTTPException(422, f"Invalid mask: {type(exc).__name__}")
    if any(value not in CLASSES for value in counts):
        raise HTTPException(422, "Unknown class value in mask")
    wound = sum(n for k, n in counts.items() if k != 255)
    if wound == 0:
        raise HTTPException(422, "No wound pixels")
    return {
        "source": "manual_class_mask",
        "ai_generated": False,
        "clinical_use": False,
        "wound_pixels": wound,
        "classes": [
            {"name": name, "pixels": counts.get(code, 0),
             "percent_of_wound": round(100 * counts.get(code, 0) / wound, 2)}
            for code, name in CLASSES.items() if code != 255
        ],
        "warning": "Counts only manually supplied labels; no AI inference or diagnosis.",
    }
