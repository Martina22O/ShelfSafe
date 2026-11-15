# Mobile / 02-Home Upload Checklist

### Requirements & Naming Convention
- Naming format: `screen__state.png` (two underscores)
- Resolution: PNG at 2x or 3x resolution
- Scope: One image per screen and state

### Upload Status
- [x] `dashboard__default.png` — **Uploaded as:** `dashboard_mobile.png`
- [ ] `dashboard__loading.png` — *(No dedicated Figma design; use skeleton cards matching dimensions of `dashboard_mobile.png`)*
- [ ] `dashboard__error.png` — *(No dedicated Figma design; use alert banner styled after cards in `dashboard_mobile.png`)*
- [ ] `dashboard__no-alerts.png` — *(No dedicated Figma design; empty alerts section using card layout from `dashboard_mobile.png`)*
- [x] `tab-bar__default.png` — **Included in:** `dashboard_mobile.png` (bottom navigation bar)

### Design Reference & Fallback Guide
Per ShelfSafe Design Rule #2:
- **Available Reference:** [dashboard_mobile.png](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/mobile/02-home/dashboard_mobile.png).
- This full mobile screen defines the header, greeting, summary KPI cards (total products, expiring soon, expired), alert cards, and bottom navigation tab bar.
- For loading or error states, maintain the exact grid, padding, and radii of the summary cards.
