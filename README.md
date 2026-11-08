# WoundAI Pro Web v2.0 — Mobile-first PWA prototype

## Included in this package
- Persian RTL / English LTR interface, responsive for phone and desktop.
- Approved WoundAI logo asset used in the app shell.
- Patient record creation, search, archive/activate, local persistence.
- Multiple wound records per patient.
- Camera access via `getUserMedia` on HTTPS, camera switching, still capture by tapping the preview, and gallery upload fallback.
- Manual wound boundary polygon tracing, undo/clear, reference-scale calibration, and area calculation only when calibrated.
- Local JSON backup/restore and CSV patient export.
- Explicit AI status: no validated AI model is bundled; no automatic wound detection or clinical grading is fabricated.
- Security status page explaining local-only storage and production requirements.

## Run on a phone
1. Upload the extracted folder contents to a static HTTPS host (GitHub Pages is sufficient for this local prototype).
2. Open the site in Chrome/Safari. Camera access requires HTTPS and browser permission.
3. Install from the browser menu if offered (Add to Home Screen).
4. Use only synthetic/test data. Export a JSON backup regularly while evaluating the prototype.

## Important limitations
This is a front-end prototype, not a production clinical system. Data is stored in browser localStorage on one device. There is no cloud account, cross-device sync, server-side encryption, multi-clinic access control, MFA, or server backup. Do not enter identifiable or real patient data.

No trained/validated AI detection or segmentation weights are included. The imaging workflow supports manual tracing and calibrated area calculation. Wound depth must be entered using an appropriate clinical method, not inferred from a 2D photo. Clinical classification tools (SINBAD, WIfI, IWGDF/IDSA, Wagner, University of Texas, NPIAP, PUSH, BWAT) require verified rule tables, licensed content where applicable, and clinician validation before implementation; they are not represented as operational scoring engines in this prototype.

## Production architecture still required
A secure backend/API, relational database, private encrypted object storage, authentication/MFA, role-based access, organization isolation, append-only audit events, automated encrypted backup/restore, consent/version management, clinical validation, privacy/legal review (including GDPR/DPIA and applicable medical-device rules), and independent AI validation.
