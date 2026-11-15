# ShelfSafe UI Screen Map & Design References

This document maps all screens and states for ShelfSafe Mobile and Web applications to their design reference assets in `docs/design/`.

---

## 📱 Mobile Application Screens

All mobile designs use standard mobile viewport dimensions (402px wide, phone aspect ratio).

| Screen / Flow | State | Reference File | Status | Notes / Fallback Reference |
| :--- | :--- | :--- | :--- | :--- |
| **01-Auth** | Welcome / Landing | `mobile/01-auth/landing-page_mobile.png` | ✅ Available | Brand background, logo lockup, "Sign In" and "Create Account" buttons |
| | Sign In | `mobile/01-auth/sign-in_mobile.png` | ✅ Available | Input fields (Email, Password), Sign In button, Forgot Password link |
| | Sign In Error | — | 🔄 Fallback | Derive field error styling from `create-acc_mobile.png` |
| | Create Account | `mobile/01-auth/create-acc_mobile.png` | ✅ Available | Multi-field registration form, Terms link, Submit button |
| | Create Account Error | — | 🔄 Fallback | Reuse field validation error styling from `create-acc_mobile.png` |
| | Check Email | — | 🔄 Fallback | Card and primary button layout from `sign-in_mobile.png` |
| | Forgot Password | — | 🔄 Fallback | Input and action button styling from `sign-in_mobile.png` |
| **02-Home** | Dashboard Default | `mobile/02-home/dashboard_mobile.png` | ✅ Available | Greeting header, 3 KPI metric cards, expiry warning list, bottom tab bar |
| | Dashboard Loading | — | 🔄 Fallback | Shimmer skeleton cards matching metric card dimensions |
| | Dashboard Error | — | 🔄 Fallback | Alert card banner matching warning card style |
| | Tab Bar | `mobile/02-home/dashboard_mobile.png` | ✅ Available | Bottom navigation bar (Home, Inventory, Scan, Alerts, Profile) |
| **03-Inventory** | Inventory List | `mobile/03-inventory/inventory_mobile.png` | ✅ Available | Search bar, filter pills, product list cards, stock count, expiry status |
| | Product Detail | `mobile/03-inventory/sample-inventory_mobile.png` | ✅ Available | Header, product metadata, batch list with FEFO ordering, Action buttons |
| | Filtered List | — | 🔄 Fallback | Use `inventory_mobile.png` with active filter chips |
| | Empty List | — | 🔄 Fallback | Centered muted icon & typography matching inventory list |
| | Dialogs & Modals | — | 🔄 Fallback | Dialog cards and buttons styled from `sample-inventory_mobile.png` |
| **04-Scan** | Camera Viewfinder | `mobile/04-scan/scan_mobile.png` | ✅ Available | Full screen viewfinder, guidance frame, flash toggle, manual input option |
| | Manual Barcode Input | — | 🔄 Fallback | Input field styling from `create-acc_mobile.png` |
| | Add Stock Form | — | 🔄 Fallback | Form fields from `create-acc_mobile.png`, batch details from `sample-inventory_mobile.png` |
| | Sale & FEFO Deductions| — | 🔄 Fallback | FEFO deduction list follows batch card style from `sample-inventory_mobile.png` |
| | History & Undo | — | 🔄 Fallback | Chronological list styled from `inventory_mobile.png` |
| **05-Alerts** | Notifications Default | `mobile/05-alerts/notification_mobile.png` | ✅ Available | Segmented filter pills (All, Unread), urgency color badges, notification cards |
| | Empty Alerts | — | 🔄 Fallback | Centered bell icon with muted copy |
| **06-Profile** | Profile Default | `mobile/06-profile/profile_mobile.png` | ✅ Available | User avatar, info header, navigation item rows with chevrons, Sign Out button |
| | Edit Forms / Dialogs | — | 🔄 Fallback | Form inputs from `create-acc_mobile.png`, dialogs from `sample-inventory_mobile.png` |
| **States** | Loading / Empty / Error | — | 🔄 Fallback | See `mobile/states/_UPLOAD_HERE.md` for design system fallback specifications |

---

## 💻 Web Application Screens

All web designs use desktop viewport dimensions (~1024px–1036px wide).

| Screen / Flow | State | Reference File | Status | Notes / Fallback Reference |
| :--- | :--- | :--- | :--- | :--- |
| **01-Auth** | Sign In Default | `web/01-auth/sign-in_default.png` | ✅ Available | Split desktop auth card, left brand illustration panel, right form |
| | Sign Up Default | `web/01-auth/create-account_default.png` | ✅ Available | Split desktop registration card |
| **02-Shell** | Desktop Shell | `web/02-shell/shell__desktop.png` | ✅ Available | Sidebar navigation, logo, header search, user menu profile badge |
| | Small Screen Shell | — | 🔄 Fallback | Collapsed icon-only rail or drawer overlay |
| **03-Dashboard**| Dashboard Default | `web/03-dashboard/dashboard_default.png` | ✅ Available | Top KPI cards, quick actions, expiry alerts list, recent activity table |
| | Dashboard Loading | — | 🔄 Fallback | Skeleton loading blocks matching dashboard widgets |
| **04-Inventory**| Inventory Table | `web/04-inventory/inventory-list_default.png` | ✅ Available | Data table (Product, SKU, Category, Qty, Expiry, Status, Actions), action buttons |
| | Product Detail Drawer | — | 🔄 Fallback | Slide-out panel styled with table card elements |
| | Add Stock / Modals | — | 🔄 Fallback | Modal forms styled using inputs from `create-account_default.png` |
| **05-Alerts** | Notifications Center | `web/05-notifications/notifications_default.png`| ✅ Available | Notification feed, priority badges, filter tabs, "Mark all as read" |
| **06-History** | Movement History | `web/06-history/history_default.png` | ✅ Available | Audit log table (Date, Action, Product, Batch, Qty Change, Operator, Undo) |
| **07-Profile** | Profile & Settings | `web/07-profile/profile_default.png` | ✅ Available | Settings tabs (Profile, Store Settings, Security, Preferences) |
| **States** | Loading / Empty / Error | — | 🔄 Fallback | See `web/states/_UPLOAD_HERE.md` for design system fallback specifications |

---

## 🎨 Brand Reference Assets

- **Brand Logo & Wordmarks**: Located in [`docs/design/brand/logo/`](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/brand/logo/)
  - Primary lockup (white background): `041eb258-5c02-49da-b766-3c0cd0cc4cb4.jpg`
  - Primary lockup (light green background): `d3b68841-9f7f-4059-9d9f-9bcf01cb8089.jpg`
  - Symbol only: `b4554360-15ca-440b-96bb-ba46e2d890b4.jpg`
  - App icon (squircle): `af428e7e-0f8a-4031-8637-a078fc9b3fc0.jpg`
  - Wordmark & typography lockups: `0468f4af-0516-4a42-b26c-1caa5d0f47ca.jpg`, `2d9ccbd8-55bd-4168-80bc-c0a797e9014c.jpg`
- **Color Palette**: Located in [`docs/design/brand/7a182e74-46db-4ad1-a53f-d84d64c65c6f.jpg`](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/brand/7a182e74-46db-4ad1-a53f-d84d64c65c6f.jpg)
  - Dark Green: `#207429`
  - Forest Green: `#3e8c1f`
  - Bright Green: `#56a724`
  - Light Mint: `#f4ffe1`
  - Yellow: `#ffdb3f`
  - Amber: `#fabe44`
  - Orange-Amber: `#faab06`
- **Design Rules**: Located in [`docs/design/DESIGN_RULES.md`](file:///c:/Users/Maria/Downloads/Shelfsafe/ShelfSafe/docs/design/DESIGN_RULES.md) (11 strict rules)

