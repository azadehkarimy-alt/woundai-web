# WoundAI Release v18 — Startup identity and icon consistency

## UI updates
- Added a branded startup screen using the approved horizontal WoundAI logo.
- Displayed Version 18.0 and the requested Persian and English author credits.
- Added an accessible Enter action; the application remains inert until the splash screen is dismissed.
- Updated the topbar avatar to use the approved square logo.

## Icon audit and corrections
- Rebuilt the 192px and 512px PWA icons directly from the approved square logo.
- Replaced stale generic SVG icon artwork with references to the official square logo.
- Updated the manifest and service-worker cache to v18.

## Verification
- JavaScript and service-worker syntax checks.
- Project smoke tests plus startup/logo/credit/cache checks.
- ZIP integrity and local asset-reference checks.

## Operational limitation
The Supabase schema exists, but this GitHub Pages package still uses browser-local storage. Cloud authentication, multi-user permissions and secure server persistence require a configured Supabase project, secrets, deployment and security validation. Context-dependent controls remain disabled until their prerequisites are met.
