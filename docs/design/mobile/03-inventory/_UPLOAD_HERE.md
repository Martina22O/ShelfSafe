# Mobile / 03-Inventory Upload Checklist

### Requirements & Naming Convention
- Naming format: `screen__state.png` (two underscores)
- Resolution: PNG at 2x or 3x resolution
- Scope: One image per screen and state

### Upload Status
- [x] `inventory-list__default.png` — **Uploaded as:** `inventory_mobile.png`
- [ ] `inventory-list__filtered.png` — *(No dedicated Figma design; filter chips active on `inventory_mobile.png`)*
- [ ] `inventory-list__empty.png` — *(No dedicated Figma design; centered empty illustration & muted text)*
- [ ] `inventory-list__archived.png` — *(No dedicated Figma design; inventory list with archived badge)*
- [ ] `inventory-list__error.png` — *(No dedicated Figma design; inline error banner with retry button)*
- [x] `product-detail__default.png` — **Uploaded as:** `sample-inventory_mobile.png`
- [ ] `product-detail__archived.png` — *(No dedicated Figma design; detail view with archived badge)*
- [ ] `product-detail__not-found.png` — *(No dedicated Figma design; 404 message using detail typography)*
- [ ] `edit-product__default.png` — *(No dedicated Figma design; form modal using inputs from `create-acc_mobile.png`)*
- [ ] `edit-product__error.png` — *(No dedicated Figma design; form validation error)*
- [ ] `correct-quantity__dialog.png` — *(No dedicated Figma design; quantity adjustment dialog)*
- [ ] `correct-quantity__confirm.png` — *(No dedicated Figma design; confirm dialog)*
- [ ] `edit-dates__dialog.png` — *(No dedicated Figma design; expiry date dialog)*
- [ ] `delete-batch__confirm.png` — *(No dedicated Figma design; danger confirm dialog)*
- [ ] `delete-product__confirm.png` — *(No dedicated Figma design; danger confirm dialog)*
- [ ] `restore-product__confirm.png` — *(No dedicated Figma design; confirm dialog)*
- [ ] `action-result__deleted-or-archived.png` — *(No dedicated Figma design; toast/snackbar)*

### Design Reference & Fallback Guide
Per ShelfSafe Design Rule #2:
- **Available References:** [inventory_mobile.png](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/mobile/03-inventory/inventory_mobile.png), [sample-inventory_mobile.png](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/mobile/03-inventory/sample-inventory_mobile.png).
- `inventory_mobile.png` establishes the search bar, filter pills, product list card layout, stock badges, and expiry status tags.
- `sample-inventory_mobile.png` establishes the product detail header, batch breakdown card, FEFO expiry list, and action buttons.
- All dialogs and confirm prompts must reuse the card radii, fonts, and button styling seen in `sample-inventory_mobile.png`.
