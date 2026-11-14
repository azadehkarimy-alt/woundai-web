from io import BytesIO
import pytest
from PIL import Image
from fastapi.testclient import TestClient
import app as api_module
from app import app, require_authenticated_user

client = TestClient(app)

@pytest.fixture
def authenticated_client():
    app.dependency_overrides[require_authenticated_user] = lambda: {"user_id": "test-user"}
    yield client
    app.dependency_overrides.clear()


def test_health_reports_model_status():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["clinical_use"] is False
    assert data["model_loaded"] is False
    assert data["authentication_required"] is True


def test_analysis_requires_authentication():
    response = client.post(
        "/v1/tissue/analyze",
        files={"image": ("a.png", b"not-an-image", "image/png")}
    )
    assert response.status_code == 401


def test_manual_mask_requires_authentication():
    im = Image.new("L", (2, 1))
    im.putdata([1, 255])
    b = BytesIO()
    im.save(b, format="PNG")
    response = client.post(
        "/v1/tissue/quantify-mask",
        files={"mask": ("mask.png", b.getvalue(), "image/png")}
    )
    assert response.status_code == 401


def test_valid_image_still_has_no_unconfigured_model(authenticated_client):
    image = Image.new("RGB", (2, 2), "white")
    buf = BytesIO()
    image.save(buf, format="PNG")
    response = authenticated_client.post(
        "/v1/tissue/analyze",
        files={"image": ("a.png", buf.getvalue(), "image/png")}
    )
    assert response.status_code == 503
    assert "configured" in response.json()["detail"]


def test_manual_mask(authenticated_client):
    im = Image.new("L", (4, 1))
    im.putdata([1, 1, 2, 255])
    b = BytesIO()
    im.save(b, format="PNG")
    response = authenticated_client.post(
        "/v1/tissue/quantify-mask",
        files={"mask": ("mask.png", b.getvalue(), "image/png")}
    )
    assert response.status_code == 200
    assert response.json()["wound_pixels"] == 3
    assert response.json()["classes"][1]["percent_of_wound"] == 66.67


def test_cors_for_local_development_origin():
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5500",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5500"


def test_cors_rejects_unlisted_github_pages_origin():
    response = client.options(
        "/health",
        headers={
            "Origin": "https://unlisted-project.github.io",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 400
    assert response.headers.get("access-control-allow-origin") is None


def test_health_never_claims_clinical_use():
    data = client.get("/health").json()
    assert data["clinical_use"] is False

def test_model_adapter_rejects_wrong_mask_mode():
    import model_adapter
    from PIL import Image
    from io import BytesIO
    buf = BytesIO()
    Image.new("RGB", (2, 2), "white").save(buf, format="PNG")
    try:
        model_adapter._validate_mask(buf.getvalue(), (2, 2))
        assert False, "RGB masks must be rejected"
    except model_adapter.InvalidModelOutput:
        pass

def test_model_adapter_rejects_dimension_mismatch():
    import model_adapter
    from PIL import Image
    from io import BytesIO
    buf = BytesIO()
    Image.new("L", (1, 1), 1).save(buf, format="PNG")
    try:
        model_adapter._validate_mask(buf.getvalue(), (2, 2))
        assert False, "Mismatched mask dimensions must be rejected"
    except model_adapter.InvalidModelOutput:
        pass

def test_model_adapter_rejects_unknown_mask_codes():
    import model_adapter
    from PIL import Image
    from io import BytesIO
    buf = BytesIO()
    im = Image.new("L", (2, 1))
    im.putdata([1, 99])
    im.save(buf, format="PNG")
    try:
        model_adapter._validate_mask(buf.getvalue(), (2, 1))
        assert False, "Unknown class code must be rejected"
    except model_adapter.InvalidModelOutput:
        pass

def test_model_adapter_rejects_empty_wound_mask():
    import model_adapter
    from PIL import Image
    from io import BytesIO
    buf = BytesIO()
    im = Image.new("L", (2, 1))
    im.putdata([255, 255])
    im.save(buf, format="PNG")
    try:
        model_adapter._validate_mask(buf.getvalue(), (2, 1))
        assert False, "Mask without wound pixels must be rejected"
    except model_adapter.InvalidModelOutput:
        pass


def test_model_runtime_requires_verified_checkpoint(monkeypatch, tmp_path):
    import sys
    import types
    import model_adapter
    checkpoint = tmp_path / "weights.bin"
    checkpoint.write_bytes(b"fixture checkpoint")
    fake = types.ModuleType("woundai_fake_unverified")
    fake.model_status = lambda: {
        "runtime_ready": True,
        "model_name": "Fixture",
        "model_version": "test"
    }
    fake.predict = lambda image_bytes: {}
    monkeypatch.setitem(sys.modules, "woundai_fake_unverified", fake)
    monkeypatch.setenv("WOUNDAI_INFERENCE_MODULE", "woundai_fake_unverified")
    monkeypatch.setenv("WOUNDAI_CHECKPOINT_PATH", str(checkpoint))
    monkeypatch.setenv("WOUNDAI_CHECKPOINT_SHA256", "0" * 64)
    status = model_adapter.model_status()
    assert status["checkpoint_exists"] is True
    assert status["checkpoint_verified"] is False
    assert status["inference_ready"] is False


def test_plugin_output_is_research_only_and_mask_is_validated(monkeypatch, tmp_path):
    import sys
    import types
    import hashlib
    import model_adapter
    checkpoint = tmp_path / "weights.bin"
    checkpoint_bytes = b"fixture checkpoint for unit test only"
    checkpoint.write_bytes(checkpoint_bytes)
    fake = types.ModuleType("woundai_fake_verified")
    fake.model_status = lambda: {
        "runtime_ready": True,
        "model_name": "FixtureSegmentation",
        "model_version": "0.0-test",
        "model_card_id": "fixture-only",
        "training_domain": "synthetic unit-test fixture",
        "license": "test fixture"
    }
    def fake_predict(image_bytes):
        mask = Image.new("L", (2, 2))
        mask.putdata([1, 2, 3, 255])
        buf = BytesIO()
        mask.save(buf, format="PNG")
        return {
            "mask_png": buf.getvalue(),
            "class_confidence": {"granulation": 0.8, "slough": 0.7, "necrosis": 0.6},
            "quality_flags": ["unit-test fixture only"]
        }
    fake.predict = fake_predict
    monkeypatch.setitem(sys.modules, "woundai_fake_verified", fake)
    monkeypatch.setenv("WOUNDAI_INFERENCE_MODULE", "woundai_fake_verified")
    monkeypatch.setenv("WOUNDAI_CHECKPOINT_PATH", str(checkpoint))
    monkeypatch.setenv("WOUNDAI_CHECKPOINT_SHA256", hashlib.sha256(checkpoint_bytes).hexdigest())
    image = Image.new("RGB", (2, 2), "white")
    buf = BytesIO()
    image.save(buf, format="PNG")
    result = model_adapter.predict_tissue(buf.getvalue())
    assert result["ai_generated"] is True
    assert result["research_only"] is True
    assert result["clinical_use"] is False
    assert result["diagnosis"] is None
    assert result["wound_pixels"] == 3
    assert len(result["mask_png_base64"]) > 0


def test_api_rejects_invalid_plugin_mask_with_502(authenticated_client, monkeypatch, tmp_path):
    import sys
    import types
    import hashlib
    checkpoint = tmp_path / "weights.bin"
    payload = b"unit-test checkpoint"
    checkpoint.write_bytes(payload)
    fake = types.ModuleType("woundai_fake_bad_output")
    fake.model_status = lambda: {
        "runtime_ready": True, "model_name": "Fixture", "model_version": "test"
    }
    fake.predict = lambda image_bytes: {
        "mask_png": b"not-a-png",
        "class_confidence": {},
        "quality_flags": []
    }
    monkeypatch.setitem(sys.modules, "woundai_fake_bad_output", fake)
    monkeypatch.setenv("WOUNDAI_INFERENCE_MODULE", "woundai_fake_bad_output")
    monkeypatch.setenv("WOUNDAI_CHECKPOINT_PATH", str(checkpoint))
    monkeypatch.setenv("WOUNDAI_CHECKPOINT_SHA256", hashlib.sha256(payload).hexdigest())
    image = Image.new("RGB", (2, 2), "white")
    buf = BytesIO()
    image.save(buf, format="PNG")
    response = authenticated_client.post(
        "/v1/tissue/analyze",
        files={"image": ("a.png", buf.getvalue(), "image/png")}
    )
    assert response.status_code == 502
    assert "Model output rejected" in response.json()["detail"]


def test_auth_fails_closed_when_supabase_server_config_missing(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_PUBLISHABLE_KEY", raising=False)
    response = client.post(
        "/v1/tissue/analyze",
        headers={"Authorization": "Bearer syntactically-present-token"},
        files={"image": ("a.png", b"not-an-image", "image/png")}
    )
    assert response.status_code == 503
    assert "پیکربندی نشده" in response.json()["detail"]


def test_supabase_auth_token_is_checked_by_auth_service(monkeypatch):
    class FakeResponse:
        status_code = 401
        def json(self):
            return {"message": "invalid token"}
    class FakeAsyncClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): return False
        async def get(self, url, headers):
            assert url == "https://project.example/auth/v1/user"
            assert headers["Authorization"] == "Bearer bad-token"
            return FakeResponse()
    monkeypatch.setenv("SUPABASE_URL", "https://project.example")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "public-test-key")
    monkeypatch.setattr(api_module.httpx, "AsyncClient", lambda **kwargs: FakeAsyncClient())
    response = client.post(
        "/v1/tissue/analyze",
        headers={"Authorization": "Bearer bad-token"},
        files={"image": ("a.png", b"not-an-image", "image/png")}
    )
    assert response.status_code == 401


def test_api_rate_limit_returns_429(authenticated_client, monkeypatch):
    monkeypatch.setenv("WOUNDAI_API_REQUESTS_PER_MINUTE", "1")
    api_module._rate_events.clear()
    image = Image.new("RGB", (2, 2), "white")
    buf = BytesIO()
    image.save(buf, format="PNG")
    payload = buf.getvalue()
    first = authenticated_client.post(
        "/v1/tissue/analyze",
        files={"image": ("a.png", payload, "image/png")}
    )
    second = authenticated_client.post(
        "/v1/tissue/analyze",
        files={"image": ("a.png", payload, "image/png")}
    )
    assert first.status_code == 503  # No model configured; request passed auth and limiter.
    assert second.status_code == 429


def test_image_sanitization_removes_exif_metadata():
    from app import _sanitize_image
    image = Image.new("RGB", (4, 4), "white")
    exif = Image.Exif()
    exif[270] = "patient identifier test metadata"
    buf = BytesIO()
    image.save(buf, format="JPEG", exif=exif)
    sanitized = _sanitize_image(buf.getvalue())
    with Image.open(BytesIO(sanitized)) as cleaned:
        assert cleaned.getexif().get(270) is None
        assert cleaned.size == (4, 4)


def test_audit_migration_uses_database_generated_immutable_events():
    from pathlib import Path
    migration = Path(__file__).resolve().parents[1] / "supabase/migrations/202611140003_woundai_v30_5_security_audit.sql"
    sql = migration.read_text(encoding="utf-8")
    assert "security definer" in sql.lower()
    assert "drop policy if exists \"members append audit\"" in sql
    assert "revoke insert, update, delete on public.audit_events from anon, authenticated" in sql
    for table in ["patients", "wounds", "wound_images", "assessments", "care_plans"]:
        assert f"woundai_audit_{table}" in sql
    assert "changed_fields" in sql
    assert "old_row->k is distinct from new_row->k" in sql
