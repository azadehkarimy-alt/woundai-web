# WoundAI Release v14

- Added experimental, seed-guided color-region growing for assisted wound-region separation.
- Added adjustable RGB similarity threshold, overlay preview, clear/reset and area estimate from pixel count when scale calibration exists.
- Segmentation method and parameters are retained as provenance in the saved image record.
- Manual polygon tracing remains available and takes precedence when a closed manual boundary is present.
- Added UI safety language: this is not a trained CNN, diagnostic output or validated tissue classifier.
- Added static tests for the new segmentation controls and helper functions.

Limitations: seed-based RGB region growing is sensitive to lighting, skin tone, exudate, dressings, camera white balance and heterogeneous wound beds. It is an experimental assistance tool only; clinician review and correction are mandatory. It does not identify infection, tissue types or healing status.

- Extended longitudinal history table to compare assessor-entered granulation/slough/necrosis percentages, exudate and recorded infection severity across visits.
