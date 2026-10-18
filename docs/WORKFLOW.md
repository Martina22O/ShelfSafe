# Prompting Workflow & Scope Guidelines

To ensure precise, reliable code changes, always specify a **SCOPE** when assigning tasks to the assistant.

---

## 1. Scope Definitions

| Scope | Target Directory / Area | Description |
|---|---|---|
| **FRONTEND** | `apps/web` | Web UI, pages, components, and Tailwind styles |
| **MOBILE** | `apps/mobile` | Expo screens, components, barcode scanner, mobile styles |
| **BACKEND** | API routes, server logic, FEFO RPC functions | Business logic, API endpoints, deduction processing |
| **DATABASE** | `supabase/` | Migration files, table schemas, RLS policies |
| **COMBINATIONS** | e.g., `FRONTEND + BACKEND` | Explicitly allows edits across multiple defined scopes |

> **Rule:** The assistant will modify **only** files within the declared scope. If no scope is specified, the assistant will pause and ask you to clarify before making changes.

---

## 2. Recommended Prompt Format

```markdown
SCOPE: <FRONTEND | MOBILE | BACKEND | DATABASE | COMBINATION>

Task: <Short description of the task>
Requirements:
- <Specific feature requirement 1>
- <Specific feature requirement 2>
References: <e.g., Figma screenshot in docs/design/filename.png>
```

---

## 3. Examples

### Example 1: DATABASE Scope
```markdown
SCOPE: DATABASE

Task: Create migration for products and batches tables.
Requirements:
- Add `products` table with id, name, barcode, category, price, and timestamps.
- Add `batches` table with id, product_id (foreign key), quantity_left, purchase_date, and expiration_date.
- Add index on `products.barcode`.
- Do not add demo data yet.
```

### Example 2: FRONTEND Scope
```markdown
SCOPE: FRONTEND

Task: Build the low-stock and near-expiry alert cards on the Home dashboard.
Requirements:
- Add summary cards to `apps/web/src/app/page.tsx` or a new component in `apps/web/src/components/`.
- Match the layout from `docs/design/web-dashboard.png`.
- Use mock data for now; do not call backend APIs.
```

### Example 3: MOBILE Scope
```markdown
SCOPE: MOBILE

Task: Set up the Sold-Item barcode scanner screen.
Requirements:
- Implement `CameraView` from `expo-camera` targeting EAN-13, EAN-8, UPC-A, and Code 128 barcodes.
- Add a manual numeric keypad input button as a fallback.
- Include a 1.5-second debounce to avoid duplicate scans.
- Follow the mobile screen mockup in `docs/design/scanner.png`.
```
