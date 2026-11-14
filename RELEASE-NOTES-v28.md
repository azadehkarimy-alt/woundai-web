# WoundAI V28 (experimental API connection)
- Startup and installed app version changed to 28.
- CRM and TRM previews retained.
- Added a dedicated tissue API screen with HTTPS server health check.
- No patient data, images, or API keys are sent or stored by this screen.
- TiSage pretrained weights and executable inference are **NOT included**; no automatic wound segmentation is claimed.
- Research-only API scaffold is included under `research-tissue-api`.
- Server must provide /health and explicitly report model_loaded; model accuracy and privacy must be validated before image upload.
- Back up existing patient data before upgrading; phone tests not yet performed.
