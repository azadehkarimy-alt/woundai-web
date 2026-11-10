# WoundAI Release v16 — Longitudinal clinical reporting

## Changes
- Added an executive overview page to the full history PDF.
- Added a vector area trend chart from valid recorded image measurements.
- Added a longitudinal table for wound area, granulation, slough, necrosis, exudate and clinician-entered infection severity.
- Added ABI/TBI, pedal pulse, neuropathy, offloading, interventions and clinician notes to each visit page.
- Added a longitudinal trend summary to the report preview.
- Added area trend chart to the single-report PNG when at least two valid measurements exist.
- Improved historical image association: use the image ID stored in the assessment, otherwise choose the nearest preceding image for the same wound rather than always using the latest image.
- Bumped PWA cache to v16.

## Interpretation and safety
- Trend chart plots recorded area only. It does not infer healing, infection or prognosis.
- Tissue percentages and infection severity are clinician-entered observations, not image-AI outputs.
- Image comparisons are meaningful only when scale, camera angle, distance and lighting are sufficiently consistent.
- PDF is generated through the browser print dialog; select Save as PDF.

## Checks
- `node --check app.js`
- `node --check sw.js`
- `node tests/smoke-check.mjs`
- Unique HTML ID check
- ZIP integrity check
