# Web / States Upload Checklist

### Requirements & Naming Convention
- Naming format: `screen__state.png` (two underscores)
- Resolution: PNG at 2x or 3x resolution
- Scope: One image per screen and state

### Upload Status
- [ ] `loading.png` — *(No dedicated Figma design)*
- [ ] `error-with-retry.png` — *(No dedicated Figma design)*
- [ ] `empty.png` — *(No dedicated Figma design)*
- [ ] `success-message.png` — *(No dedicated Figma design)*

### Design Reference & Fallback Guide
Per ShelfSafe Design Rule #2 (Never invent; reuse closest component from available references):
- **Empty States**: Centered in table card or full page, 48px muted icon, 16px title, 14px description with optional primary button.
- **Loading States**: Shimmer skeleton table rows and widget cards matching dimensions from [inventory-list_default.png](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/web/04-inventory/inventory-list_default.png) and [dashboard_default.png](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/web/03-dashboard/dashboard_default.png).
- **Error States**: Alert banner or full-page error callout using danger red accent (`#d32f2f`) and primary green retry button.
- **Success Messages**: Floating toast in bottom-right / top-right with brand green (`#207429`) checkmark.
