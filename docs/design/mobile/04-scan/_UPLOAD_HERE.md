# Mobile / 04-Scan Upload Checklist

### Requirements & Naming Convention
- Naming format: `screen__state.png` (two underscores)
- Resolution: PNG at 2x or 3x resolution
- Scope: One image per screen and state

### Upload Status
- [ ] `scan-chooser__default.png` — *(No dedicated Figma design; option sheet using button styling from `sample-inventory_mobile.png`)*
- [x] `scan-camera__default.png` — **Uploaded as:** `scan_mobile.png`
- [ ] `scan-camera__permission-denied.png` — *(No dedicated Figma design; camera permission prompt)*
- [ ] `scan-camera__hint.png` — *(No dedicated Figma design; viewfinder hint overlay)*
- [ ] `type-barcode__default.png` — *(No dedicated Figma design; manual barcode input using `create-acc_mobile.png` textfields)*
- [ ] `type-barcode__name-search.png` — *(No dedicated Figma design; search suggestions list)*
- [ ] `add-stock-form__default.png` — *(No dedicated Figma design; form using inputs from `create-acc_mobile.png` & cards from `sample-inventory_mobile.png`)*
- [ ] `add-stock-form__error.png` — *(No dedicated Figma design; form validation error)*
- [ ] `new-product__default.png` — *(No dedicated Figma design; full product creation form)*
- [ ] `new-product__error.png` — *(No dedicated Figma design; form validation error)*
- [ ] `add-stock-done__default.png` — *(No dedicated Figma design; success screen)*
- [ ] `sale-list__default.png` — *(No dedicated Figma design; FEFO batch deductions list following `sample-inventory_mobile.png`)*
- [ ] `sale-list__quantity-error.png` — *(No dedicated Figma design; quantity alert banner)*
- [ ] `sale-list__empty.png` — *(No dedicated Figma design; empty cart state)*
- [ ] `confirm-sale__default.png` — *(No dedicated Figma design; sale confirmation dialog)*
- [ ] `confirm-sale__error.png` — *(No dedicated Figma design; sale error dialog)*
- [ ] `sale-done__default.png` — *(No dedicated Figma design; sale completed banner with undo action)*
- [ ] `history__default.png` — *(No dedicated Figma design; history list using card layout from `inventory_mobile.png`)*
- [ ] `history__empty.png` — *(No dedicated Figma design; empty history state)*
- [ ] `history__undo-confirm.png` — *(No dedicated Figma design; undo sale confirmation dialog)*

### Design Reference & Fallback Guide
Per ShelfSafe Design Rule #2:
- **Available Reference:** [scan_mobile.png](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/mobile/04-scan/scan_mobile.png).
- For scanning, viewfinder overlay and camera controls are governed by `scan_mobile.png`.
- For subsequent sales, batch deductions, and add-stock forms:
  - Input fields and forms reuse the design system of [create-acc_mobile.png](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/mobile/01-auth/create-acc_mobile.png).
  - Batch listings and FEFO deductions reuse the batch card styles from [sample-inventory_mobile.png](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/mobile/03-inventory/sample-inventory_mobile.png).
