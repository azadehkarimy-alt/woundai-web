# WoundAI Version 30.1 — Release Notes

## Scope
First stabilization/security increment of the Version 30 roadmap, based on the v29 archive and the independent v29 audit.

## Fixed in this increment
- Updated app version, PWA manifest and service-worker cache to 30.1.
- Repaired the smoke-check version assertions and expanded checks to 14 application pages.
- Added mobile navigation scrim, Escape dismissal, `aria-expanded`, and bounded sidebar scrolling.
- Added a baseline Content Security Policy with same-origin scripts, restricted object/base/form sources, and explicit connect sources.
- Removed the remote Google Fonts dependency; system font fallbacks are used to keep the app offline-capable.
- Reduced large logo PNG dimensions while preserving transparency and filenames.
- Removed duplicated image thumbnail payloads for new records and migrated identical stored thumbnails during load/restore.
- Validated imported image data URLs and record identifiers; hardened the reported image-source XSS paths.
- Fixed encrypted backup restore to include appointments and made restore rollback on storage failure.
- Patient deletion now removes linked appointments and restores prior in-memory state if persistence fails.
- Dashboard assessment count now includes only clinical assessments linked to existing wounds.
- Care-plan recalculation preserves clinician edit text and review checkbox.
- Removed duplicate legacy `addWound` and duplicate `latestImageForWound` declarations.
- Unified main/standalone API health checks in `tissue-api-v30.js`.
- Added explicit HTTPS API origin allowlisting in `api-config.js`; localhost HTTP is permitted only for local development.
- Added CORS allowlisting in the FastAPI prototype, real adapter status in `/health`, image validation/size/pixel caps, and test dependencies.
- API test suite now includes CORS tests for local development and GitHub Pages.
- API health response display is capped; no patient image or patient data is sent by the health-check page.

## Tests
- Node syntax checks: app.js, sw.js, tissue-api-v30.js, api-config.js — passed.
- Node smoke check — passed (262 unique DOM IDs, 14 core pages).
- Python API tests — 6 passed.

## Known limitations / not fixed in 30.1
- The application still uses browser LocalStorage; there is no production authentication, central database, multi-user access control, server-side encryption, or server audit trail.
- The API prototype has no authentication or production rate limiting and must not be exposed publicly.
- No trained/validated image model or TiSage checkpoint is bundled. `/v1/tissue/analyze` intentionally returns 503.
- TiSage suitability for general wound populations and its commercial licensing require independent review.
- Full browser/device tests and a live GitHub Actions run remain outstanding.
- The app is still a development/research prototype and must not be used with identifiable real patient data.

See `V30-REMEDIATION-TRACKER-FA.md` for the complete item-by-item audit status and remaining work.
