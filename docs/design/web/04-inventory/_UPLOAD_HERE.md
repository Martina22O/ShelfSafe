# Web / 04-Inventory Upload Checklist

### Requirements & Naming Convention
- Naming format: `screen__state.png` (two underscores)
- Resolution: PNG at 2x or 3x resolution
- Scope: One image per screen and state

### Upload Status
- [x] `inventory-list__default.png` — **Uploaded as:** `inventory-list_default.png`
- [ ] `inventory-list__filtered.png` — *(No dedicated Figma design; table with filter tags active)*
- [ ] `inventory-list__empty.png` — *(No dedicated Figma design; empty table row with centered message)*
- [ ] `inventory-list__archived.png` — *(No dedicated Figma design; archived filter tab)*
- [ ] `inventory-list__error.png` — *(No dedicated Figma design; table error retry banner)*
- [ ] `product-detail__default.png` — *(No dedicated Figma design; slide-out drawer or page using table card styling)*
- [ ] `product-detail__archived.png` — *(No dedicated Figma design; drawer with archived badge)*
- [ ] `product-detail__not-found.png` — *(No dedicated Figma design; 404 message)*
- [ ] `edit-product__default.png` — *(No dedicated Figma design; edit form modal)*
- [ ] `add-stock__find.png` — *(No dedicated Figma design; barcode find modal)*
- [ ] `add-stock__form.png` — *(No dedicated Figma design; batch entry form modal)*
- [ ] `add-stock__done.png` — *(No dedicated Figma design; stock added toast)*
- [ ] `new-product__default.png` — *(No dedicated Figma design; product creation modal)*
- [ ] `new-product__done.png` — *(No dedicated Figma design; success toast)*
- [ ] `correct-quantity__dialog.png` — *(No dedicated Figma design; correction modal)*
- [ ] `edit-dates__dialog.png` — *(No dedicated Figma design; date edit modal)*
- [ ] `delete__confirm.png` — *(No dedicated Figma design; danger confirm modal)*

### Design Reference & Fallback Guide
Per ShelfSafe Design Rule #2:
- **Available Reference:** [inventory-list_default.png](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/web/04-inventory/inventory-list_default.png).
- Defines the inventory data table (columns: Product, SKU/Barcode, Category, Quantity, Expiry, Status, Actions), action buttons (Add Product, Export, Filter), and status pill badges.
- All modals and dialogs reuse the form input styling from [create-account_default.png](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/web/01-auth/create-account_default.png).
