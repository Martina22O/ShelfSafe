# Mobile / 01-Auth Upload Checklist

### Requirements & Naming Convention
- Naming format: `screen__state.png` (two underscores)
- Resolution: PNG at 2x or 3x resolution
- Scope: One image per screen and state

### Upload Status
- [x] `welcome__default.png` — **Uploaded as:** `landing-page_mobile.png`
- [x] `sign-in__default.png` — **Uploaded as:** `sign-in_mobile.png`
- [ ] `sign-in__error.png` — *(No dedicated Figma design; derive error text/field border from `create-acc_mobile.png`)*
- [x] `create-account__default.png` — **Uploaded as:** `create-acc_mobile.png`
- [ ] `create-account__error.png` — *(No dedicated Figma design; derive from `create-acc_mobile.png`)*
- [ ] `create-account__check-email.png` — *(No dedicated Figma design; derive card & button style from `sign-in_mobile.png`)*
- [ ] `forgot-password__default.png` — *(No dedicated Figma design; derive input & button style from `sign-in_mobile.png`)*

### Design Reference & Fallback Guide
Per ShelfSafe Design Rule #2:
- **Available References:** [landing-page_mobile.png](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/mobile/01-auth/landing-page_mobile.png), [sign-in_mobile.png](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/mobile/01-auth/sign-in_mobile.png), [create-acc_mobile.png](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/mobile/01-auth/create-acc_mobile.png).
- For unmodeled states (e.g. error messages, verification steps, password reset), reuse the exact typography, button corner radii, input borders, and primary green buttons shown in `create-acc_mobile.png` and `sign-in_mobile.png`.
