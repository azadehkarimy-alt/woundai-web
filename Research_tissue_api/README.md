# WoundAI Tissue API — v30.5 (Research integration)

## Authentication is mandatory
Both image analysis and manual mask quantification require a Supabase access token:
`Authorization: Bearer <Supabase access_token>`.
The API validates it against the configured Supabase Auth `/auth/v1/user` endpoint.
Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` on the API server. If either is
missing, protected endpoints fail closed with HTTP 503. Missing/invalid bearer
tokens receive HTTP 401. The browser client obtains a refreshed short-lived token
from the existing Supabase session; it does not embed a service-role key or a
long-lived API secret.

## Rate limiting and CORS
Protected POST endpoints have a per-process limit configured by
`WOUNDAI_API_REQUESTS_PER_MINUTE` (default 12/minute per client address and route).
This is defense in depth only. Multi-worker/multi-instance deployments MUST add
a shared gateway rate limit. Do not trust forwarded client-IP headers unless a
trusted reverse proxy is explicitly configured.
CORS accepts only exact origins listed in `WOUNDAI_ALLOWED_ORIGINS`. There is no
wildcard or broad GitHub Pages origin regex. Configure the exact production app
origin before deployment.

## Image privacy
The API decodes and re-encodes uploaded images before inference, dropping EXIF
and other embedded metadata. The API still cannot establish consent or guarantee
that a person has removed all identifying visual content; users must upload
only appropriately de-identified research images with a lawful basis.

## Run locally
```bash
cd research-tissue-api
python -m pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000 --env-file ../.env
```

No model plugin or checkpoint is bundled. Therefore `/health` reports
`model_loaded=false` and `/v1/tissue/analyze` returns HTTP 503 after successful
authentication. This is expected and intentionally avoids fabricated predictions.

## Research inference plugin
Set `WOUNDAI_INFERENCE_MODULE`, `WOUNDAI_CHECKPOINT_PATH`, and
`WOUNDAI_CHECKPOINT_SHA256` only on a trusted server. See
`INFERENCE-PLUGIN-CONTRACT-FA.md`. The adapter computes and compares the
checkpoint SHA-256 itself. This is a technical integrity gate, not clinical
validation.

## Model selection and validation
Read `MODEL-VALIDATION-PROTOCOL-FA.md` before selecting any checkpoint.
TiSage remains a research candidate only; no weights or official runtime are
bundled and no clinical performance is claimed.

## Deployment restrictions
The API is still a research prototype. It does not yet bind analysis requests to
a clinic, patient consent record, or persistent per-image audit entry. It must
not be exposed publicly or used with identifiable patient images until
production authorization, clinic-level authorization, distributed rate
limiting, durable audit, security testing, privacy/legal review, and clinical
validation are complete.
