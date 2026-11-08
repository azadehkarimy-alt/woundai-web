# WoundAI Pro Web — PWA v4.0

This is an incremental PWA build for mobile and desktop.

## Included in this build
- Uses the user-provided approved WoundAI wordmark artwork in the app brand area.
- Generates 192px and 512px install icons from that same supplied logo artwork.
- Adds a standard wound photography guide (lighting, perpendicular angle, full wound margin, scale at skin level).
- Camera preview no longer silently captures the first video frame. The user must tap **Capture photo**.
- Front/rear camera switching is available where supported by the browser.
- Adds two-point on-image scale selection: tap both ends of a known ruler/card distance, enter the real length in cm, then set calibration.
- Keeps manual polygon tracing and labels measurements as manual, clinician-reviewed measurements.
- Bumps the service-worker cache name to v4 to avoid serving stale v3 assets.

## Deploy to GitHub Pages
Upload the *contents* of this folder to the repository root, including `assets/`, then commit to the Pages source branch. Do not upload the ZIP as a single file.

## Important limitations
This is still a research/prototype build. It does not contain a clinically validated automatic wound segmentation model, a secure multi-user backend, or a central database. Local browser storage is not suitable for identifiable real-patient data. Do not use it as a clinical decision system.
