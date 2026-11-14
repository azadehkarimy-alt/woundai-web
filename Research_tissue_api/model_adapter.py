"""Strict adapter contract for a separately installed, verified research model.

No model weights are bundled. The default state is unavailable (503). A trusted
server administrator may configure WOUNDAI_INFERENCE_MODULE to a Python module
that exposes model_status() and predict(image_bytes). This is NOT a clinical
approval mechanism; clinical_use is always false.
"""
from __future__ import annotations

import base64
import hashlib
import importlib
import io
import os
import re

from PIL import Image

MODEL_REPO = "https://huggingface.co/ksanchez84/TiSage"
SOURCE_REPO = "https://github.com/carlosh93/TiSage"
CLASSES = {
    0: "unclassified",
    1: "granulation",
    2: "slough",
    3: "necrosis",
    4: "other",
    255: "outside_wound",
}
MAX_MASK_BYTES = 8_000_000


class ModelNotConfigured(RuntimeError):
    pass


class InvalidModelOutput(RuntimeError):
    pass


def _load_runtime():
    module_name = os.getenv("WOUNDAI_INFERENCE_MODULE", "").strip()
    if not module_name:
        return None, "No trusted inference module configured."
    try:
        module = importlib.import_module(module_name)
    except Exception as exc:
        return None, f"Inference module could not be loaded: {type(exc).__name__}"
    if not callable(getattr(module, "model_status", None)) or not callable(getattr(module, "predict", None)):
        return None, "Inference module must expose model_status() and predict(image_bytes)."
    return module, None


def model_status():
    module, load_error = _load_runtime()
    checkpoint_path = os.getenv("WOUNDAI_CHECKPOINT_PATH", "").strip()
    expected_sha = os.getenv("WOUNDAI_CHECKPOINT_SHA256", "").strip().lower()
    checkpoint_configured = bool(checkpoint_path and expected_sha)
    checkpoint_exists = bool(checkpoint_path and os.path.isfile(checkpoint_path))
    actual_sha = None
    checkpoint_verified = False
    if checkpoint_exists and re.fullmatch(r"[0-9a-f]{64}", expected_sha):
        digest = hashlib.sha256()
        try:
            with open(checkpoint_path, "rb") as checkpoint_file:
                for chunk in iter(lambda: checkpoint_file.read(1024 * 1024), b""):
                    digest.update(chunk)
            actual_sha = digest.hexdigest()
            checkpoint_verified = actual_sha == expected_sha
        except OSError:
            checkpoint_verified = False
    base = {
        "model": "unconfigured",
        "checkpoint_configured": checkpoint_configured,
        "checkpoint_exists": checkpoint_exists,
        "checkpoint_verified": checkpoint_verified,
        "checkpoint_sha256": actual_sha,
        "runtime_ready": False,
        "inference_ready": False,
        "clinical_use": False,
        "reason": load_error or (
            "No trusted inference module configured." if module is None
            else "Checkpoint file or SHA-256 verification is missing or does not match."
        ),
        "source": SOURCE_REPO,
        "weights": MODEL_REPO,
    }
    if module is None:
        return base
    try:
        status = module.model_status()
        if not isinstance(status, dict):
            raise ValueError("model_status() must return a dictionary")
        runtime_ready = status.get("runtime_ready") is True
        model_name = status.get("model_name")
        model_version = status.get("model_version")
        ready = bool(runtime_ready and checkpoint_verified and model_name and model_version)
        return {
            **base,
            "model": str(model_name)[:100] if model_name else "unconfigured",
            "model_version": str(model_version)[:80] if model_version else None,
            "runtime_ready": runtime_ready,
            "inference_ready": ready,
            "model_card_id": str(status.get("model_card_id", ""))[:160] or None,
            "training_domain": str(status.get("training_domain", ""))[:300] or None,
            "license": str(status.get("license", ""))[:160] or None,
            "reason": "Research inference runtime and checkpoint SHA-256 are ready; this does not establish clinical validity."
                      if ready else base["reason"],
            "clinical_use": False,
        }
    except Exception as exc:
        return {**base, "reason": f"Model status check failed: {type(exc).__name__}"}


def _validate_mask(mask_png: bytes, expected_size: tuple[int, int]):
    if not isinstance(mask_png, (bytes, bytearray)) or not mask_png:
        raise InvalidModelOutput("Model must return non-empty PNG mask bytes.")
    if len(mask_png) > MAX_MASK_BYTES:
        raise InvalidModelOutput("Segmentation mask exceeds 8 MB.")
    try:
        with Image.open(io.BytesIO(mask_png)) as im:
            if im.format != "PNG" or im.mode != "L":
                raise InvalidModelOutput("Segmentation mask must be an 8-bit grayscale PNG.")
            if im.size != expected_size:
                raise InvalidModelOutput("Segmentation mask dimensions must match the input image.")
            if im.width * im.height > 16_000_000:
                raise InvalidModelOutput("Segmentation mask exceeds 16 megapixels.")
            im.load()
            counts = {value: count for value, count in enumerate(im.histogram()) if count}
    except InvalidModelOutput:
        raise
    except Exception as exc:
        raise InvalidModelOutput("Model returned an unreadable segmentation mask.") from exc
    if any(value not in CLASSES for value in counts):
        raise InvalidModelOutput("Mask contains unknown class codes.")
    if sum(counts.values()) == 0 or sum(n for k, n in counts.items() if k != 255) == 0:
        raise InvalidModelOutput("Mask contains no segmented wound pixels.")
    return counts


def predict_tissue(image_bytes: bytes):
    status = model_status()
    if not status.get("inference_ready"):
        raise ModelNotConfigured(status.get("reason", "Verified inference runtime is unavailable."))
    module, error = _load_runtime()
    if module is None:
        raise ModelNotConfigured(error or "Inference runtime is unavailable.")
    try:
        with Image.open(io.BytesIO(image_bytes)) as im:
            expected_size = im.size
        raw = module.predict(image_bytes)
        if not isinstance(raw, dict):
            raise InvalidModelOutput("predict() must return a dictionary.")
        mask_png = raw.get("mask_png")
        counts = _validate_mask(mask_png, expected_size)
        confidence = raw.get("class_confidence", {})
        if not isinstance(confidence, dict):
            raise InvalidModelOutput("class_confidence must be a dictionary.")
        safe_confidence = {}
        for name, score in confidence.items():
            if name not in set(CLASSES.values()) - {"outside_wound"}:
                raise InvalidModelOutput("Unknown class confidence key.")
            if isinstance(score, bool) or not isinstance(score, (int, float)) or not 0 <= score <= 1:
                raise InvalidModelOutput("Class confidence values must be numeric from 0 to 1.")
            safe_confidence[name] = round(float(score), 4)
        quality_flags = raw.get("quality_flags", [])
        if not isinstance(quality_flags, list) or len(quality_flags) > 20 or not all(isinstance(x, str) for x in quality_flags):
            raise InvalidModelOutput("quality_flags must be a short list of strings.")
        wound_pixels = sum(n for k, n in counts.items() if k != 255)
        classes = [{
            "name": name,
            "pixels": counts.get(code, 0),
            "percent_of_wound": round(100 * counts.get(code, 0) / wound_pixels, 2),
            "confidence": safe_confidence.get(name),
        } for code, name in CLASSES.items() if code != 255]
        return {
            "source": "configured_research_model",
            "ai_generated": True,
            "clinical_use": False,
            "research_only": True,
            "diagnosis": None,
            "model": status["model"],
            "model_version": status["model_version"],
            "model_card_id": status.get("model_card_id"),
            "input_width": expected_size[0],
            "input_height": expected_size[1],
            "wound_pixels": wound_pixels,
            "classes": classes,
            "quality_flags": [x[:240] for x in quality_flags],
            "mask_png_base64": base64.b64encode(mask_png).decode("ascii"),
            "warning": "Research segmentation suggestion only. Not a diagnosis, treatment recommendation, or clinically validated result. A qualified clinician must review the original image and mask.",
        }
    except InvalidModelOutput:
        raise
    except Exception as exc:
        raise InvalidModelOutput(f"Inference failed: {type(exc).__name__}") from exc
