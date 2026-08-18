# Phase 4 UI Review — Authentication and Customer Account

Reviewed on 2026-08-18 after the production build and full Playwright suite.

## Surfaces reviewed

- Account login at 390×844 and 1440×1000.
- Authenticated address management at 390×844.
- Authenticated product request history and form at 390×844.
- RTL text, mixed Persian/Latin values, bottom navigation and full-page overflow.

## Result

- No horizontal overflow at the tested mobile and desktop widths.
- Login remains focused and readable without generic dashboard styling.
- Address fields retain usable tap targets and saved/default state is clear.
- Product requests state that submission does not guarantee stock or price.
- Internal request states are translated to Persian in the customer UI.
- Private upload is exercised against MinIO by E2E; the object is never rendered as a public URL.

## Captures

- `phase-4-account-login-390x844.png`
- `phase-4-account-login-desktop-1440.png`
- `phase-4-account-addresses-390x844.png`
- `phase-4-product-request-390x844.png`

## Deferred visual work

- Replace placeholder catalog artwork with licensed product photography.
- Provider-specific Google branding is deferred until real OAuth credentials and brand review exist.
