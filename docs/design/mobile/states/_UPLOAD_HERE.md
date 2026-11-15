# Mobile / States Upload Checklist

### Requirements & Naming Convention
- Naming format: `screen__state.png` (two underscores)
- Resolution: PNG at 2x or 3x resolution
- Scope: One image per screen and state

### Upload Status
- [ ] `loading.png` — *(No dedicated Figma design)*
- [ ] `error-with-retry.png` — *(No dedicated Figma design)*
- [ ] `empty.png` — *(No dedicated Figma design)*
- [ ] `success-message.png` — *(No dedicated Figma design)*
- [ ] `offline.png` — *(No dedicated Figma design)*

### Design Reference & Fallback Guide
Per ShelfSafe Design Rule #2 (Never invent; reuse closest component from available references):
- **Empty States**: Centered muted icon (48px) + bold title (16px) + muted description (14px) using colors and fonts from [inventory_mobile.png](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/mobile/03-inventory/inventory_mobile.png).
- **Loading States**: Shimmer skeleton blocks matching the exact dimensions of card components from [dashboard_mobile.png](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/mobile/02-home/dashboard_mobile.png) and `inventory_mobile.png`.
- **Error States**: Banner or full-screen card using red danger accent (`#d32f2f`) and retry button using primary green button style from [create-acc_mobile.png](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/mobile/01-auth/create-acc_mobile.png).
- **Success Messages**: Green banner / toast using brand green (`#207429`) with white text.
- **Offline Indicator**: Compact warning banner across the top header using amber background (`#faab06`).
