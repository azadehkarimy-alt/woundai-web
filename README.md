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


## v5 usability update
- Added prominent dashboard shortcut to clinical assessment.
- Replaced tap-only boundary plotting with add-points and drag-to-edit pointer workflow.
- Added explicit boundary-close action and clearer mobile guidance.
- Imaging controls are arranged below the image in a full-width workflow.
- No validated automatic wound segmentation model or cloud backend is included.


## v6 clinical workflow update
- Scale calibration inputs are positioned immediately above the wound image.
- Boundary tracing, edit/add/close tools, area result and save controls are positioned immediately below the image.
- Added clinician-facing calculation summary for SINBAD, PUSH 3.0 component total, BWAT total, WIfI component tuple, and entered Wagner / University of Texas / NPIAP classifications.
- Added a draft care-plan builder based on entered wound etiology, signs, tissue findings and recorded values. It is a decision-support draft only and requires clinician review.
- PUSH area categories were expanded to the 0–10 area subscore bands; closed and epithelial tissue choices are separate.
- WIfI composite clinical stage is intentionally not auto-inferred from three component grades; perfusion data and official stage matrix / clinical interpretation are required.
- AI wound segmentation is still not included. No model-generated diagnosis is claimed.


## v7 report export
- Added patient + wound selector in Reports.
- Generates a one-page-style wound report as a high-resolution PNG download and print-to-PDF workflow.
- Report includes patient code/name, wound type/site, latest clinical assessment, image, measurements, tissue percentages, local signs, TIME, available scores/classifications, vitals, notes/interventions, follow-up and saved draft care plan.
- Missing fields are labeled as not recorded; report is generated from local browser data only.


## v8 brand + AI algorithm architecture
- Increased approved WoundAI logo visibility in the application sidebar and top-bar icon.
- Added explicit ANN, CNN and SVM architecture cards, following the initial wound-management research discussion.
- ANN is assigned to structured clinical/tabular data and longitudinal healing/risk modelling; CNN to image segmentation/tissue analysis; SVM to baseline/comparative classification.
- This is an architecture and integration specification only. Trained model weights, validated datasets, inference services and clinical validation are not included; no automated diagnosis is claimed.


## v9 patient portrait and ANN implementation readiness
- Added optional patient portrait upload in the patient registration form, client-side resized/compressed and saved with the local patient record; patient cards display the portrait. Wound photos remain separate in wound imaging.
- ANN task preserved from the initial project discussion: use structured clinical, image-derived and treatment/longitudinal features to estimate healing trajectory or treatment response. This requires a labelled, de-identified longitudinal dataset and a precisely defined target (e.g. percentage area reduction by a fixed follow-up window or healing/non-healing at a defined time).
- The current project contains no verified labelled training dataset or trained ANN weights. Therefore an honest trained predictor cannot be shipped yet. The UI must not fabricate predictions or reuse the literature-reported 96% as this product's performance.
- Recommended training split is patient-level (not image-level) with an independent test set; report AUROC/AUPRC for classification or MAE/RMSE for regression, calibration and subgroup performance. External validation and clinician review are required before clinical use.
