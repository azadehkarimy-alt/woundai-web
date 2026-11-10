# WoundAI Release v15 — Guideline-informed suggestions

## What changed
- Added clinician-entered fields for ABI, TBI, pedal pulses, protective sensation/neuropathy, plantar location, offloading status, pressure-injury risk, mobility and nutrition.
- Added conditional decision-support prompts based on the wound etiology and the entered values.
- Added IWGDF 2023 offloading considerations only for neuropathic plantar forefoot/midfoot diabetic ulcers, with explicit contraindication/acceptability caveats.
- Added arterial perfusion checks before any venous compression suggestion; if perfusion data are missing, the app does not recommend compression.
- Added 2026 international pressure injury guideline prompts for individualized repositioning, support surfaces, skin care and nutrition.
- Added 2026 IWII infection guideline references and antimicrobial stewardship prompts.
- Added visible guideline bibliography to the generated care-plan page.
- Stored additional guideline-relevant assessment variables in the clinical record.
- Bumped PWA cache to v15 and extended smoke tests.

## Clinical safety boundary
The rules produce prompts, not prescriptions or diagnoses. They do not select antibiotics, doses, debridement methods, compression pressure, or a specific dressing product. Thresholds and recommendations require interpretation against full guideline text, local protocols, patient-specific contraindications and professional scope. No automated rule is a substitute for clinician assessment.

## Sources embedded in the app
- IWII, Wound infection in clinical practice, 4th edition, 23 Sep 2026.
- IWGDF/IDSA diabetes-related foot infection guideline, 2023.
- IWGDF offloading guideline, 2023.
- NPIAP/EPUAP/PPPIA International Pressure Injury Guideline, 4th edition, 2026.
- NICE NG152, Leg ulcer infection: antimicrobial prescribing.

## Verification
- JavaScript syntax check
- Service Worker syntax check
- Static smoke tests for new clinical inputs and guideline references
- ZIP integrity test

- Added a versioned guideline registry with publication dates, source URLs and scope notes.
- Added ABI/TBI, pulse, neuropathy, plantar-site, offloading, pressure-risk, mobility and nutrition to the Stage 7 summary.
- Clarified the clinical scope note: suggestions are conditional, rule-based and source-linked, not automatic diagnoses or prescriptions.
