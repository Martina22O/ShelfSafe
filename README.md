# ShelfSafe
 
**Smarter Stock, Safer Shelves.**
 
ShelfSafe is an inventory app for small stores. It helps the owner and staff keep track of what is on the shelf, what is selling, and what is about to expire. Staff can scan products on their phone, and the owner can check the same data on the website.
 
---
 
## The Problem
 
Small stores often track stock by hand. Products expire without anyone noticing, older stock gets left behind, and the owner has no clear picture of what is selling. ShelfSafe fixes this with barcode scanning, batch tracking, and expiry alerts.
 
---
 
## Features
 
1. **Sign In and Profile** – Users sign in to see their inventory. The Profile page has account details, change password, help, settings, and Sign Out.
2. **Home summary** – Shows the most-stocked, most-sold, and least-sold items. Also shows low-stock, near-expiry, and expired products, items sold per day, week, or month, and a preview of alerts.
3. **Inventory and categories** – Products are listed by category, with a search bar. Each product shows its total quantity, plus the quantity and dates of each batch.
4. **Add Stock scanner** – Scan the product barcode, then enter the quantity, product details, purchase date, and expiration date. Each delivery gets its own batch record.
5. **Manual product entry** – If a barcode cannot be read, the user types the number instead. A product with no barcode can be added as a new product or picked through search.
6. **Sold-item scanner** – A separate scanner for items that were sold. It updates the stock count but does **not** process payment. Use *Quantity* to record several units at once, and *Scan More* to add more units or other products.
7. **FEFO deduction** – Sold units are taken from the batch that expires first. When that batch runs out, the system moves to the next batch.
8. **History and Undo** – Lists the stock deductions made by sold-item scans. Undo reverses a wrong entry and puts the units back into the same batches they were taken from.
9. **Product corrections** – Product and batch details can be edited, with a confirmation step. A record that was never used can be deleted. A record that already has history is archived, so past stock changes can still be traced.
10. **Notifications** – A separate page lists all low-stock, near-expiry, and expired alerts. Home shows the most important ones.
11. **Website and mobile app** – Both show the same inventory and alerts. Staff can scan on the phone while the owner checks updates on the website.
---
 
## How Batches and FEFO Work
 
The barcode on a product is usually the same for every batch, even when the expiration dates are different. This means the app cannot tell which batch a scanned item came from. So ShelfSafe uses **FEFO (First-Expired, First-Out)**: it always deducts from the batch that expires first.
 
**Example:** Batch 1 has 5 units left and Batch 2 has 50 units. A customer buys 7. ShelfSafe takes 5 from Batch 1 and the other 2 from Batch 2.
 
> **Tip for stores:** Put earlier-expiring items in front of the shelf so they are picked first. This keeps the app's records matching what is really on the shelf.
 
---
 
## Tech Stack
 
| Part | Tool | Why |
| --- | --- | --- |
| Website and dashboard | **Next.js** + **Tailwind CSS** | Fast to build, easy to deploy |
| Mobile app (Android) | **React Native** with **Expo** | Same language (TypeScript) as the website |
| Barcode scanning | **expo-camera** (`CameraView`) | Built-in barcode scanner, no extra setup |
| Barcode scanning on web (backup) | **html5-qrcode** or **@zxing/browser** | Lets the website scan with the laptop or phone camera |
| Database | **PostgreSQL** (via **Supabase**) | Good for batches and stock records |
| Sign In | **Supabase Auth** | Login and password change are already built in |
| Hosting | **Vercel** (website) + **Supabase** free tier | Free for a school demo |
| Language | **TypeScript** | One language for web and mobile |
 
### About barcode scanning
 
- Most store products use **EAN-13** barcodes (the long number under the bars). Also support **EAN-8**, **UPC-A**, and **Code 128** so more products can be scanned.
- `expo-camera` reads these formats directly. Set the `barcodeTypes` to the formats above so it scans faster and makes fewer mistakes.
- Add a short delay after each successful scan so the same barcode is not counted twice.
- Always keep the **type-in-the-number** option. Damaged or blurry barcodes happen often.
- Camera scanning needs a real phone for testing. It will not work well on most emulators.
---
 
## Project Structure
 
```
shelfsafe/
├── apps/
│   ├── web/        # Next.js website and dashboard
│   └── mobile/     # Expo app (Android) with the scanner
├── supabase/       # Database tables, FEFO function, migrations
└── README.md
```
 
> Adjust this to match the actual folders in the repo.
 
---
 
## Main Data (Database Tables)
 
- **products** – name, barcode, category, price
- **batches** – product, quantity left, purchase date, expiration date
- **sales_scans** – one record for each sold-item scan
- **deductions** – which batch each sold unit was taken from (used by History and Undo)
- **users** – account details
The FEFO deduction and Undo should run as a single database function, so that stock is never half-updated if something fails.
 
---
 
## Getting Started
 
### What you need
 
- Node.js (LTS version)
- A Supabase project (free)
- An Android phone for testing the scanner
### Steps
 
```bash
# 1. Clone the repo
git clone <your-repo-url>
cd shelfsafe
 
# 2. Install packages
npm install
 
# 3. Add your environment variables
cp .env.example .env
# then fill in your Supabase URL and key
 
# 4. Run the website
npm run dev --workspace web
 
# 5. Run the mobile app
npx expo start
```
 
Open the Expo app on your phone and scan the QR code to try the scanner.
 
---
 
## Design Notes
 
- **Navigation:** Add Stock and Sold-item Scan are two separate actions. Categories are shown on screen, not hidden behind a button.
- **Home and alerts:** Home has key summaries and a few alert previews. Notifications has its own page with the full list.
- **Sale check:** Before a sale is confirmed, the app shows the product, quantity, and which batches will be deducted.
- **Profile:** A full Profile page and a simple Sign In screen.
- **Branding:** The color palette comes from the existing ShelfSafe logo. The logo font is made easier to read, and the quote is a separate tagline.
---
 
## Scope
 
ShelfSafe records stock only. It does **not** process payments. Photo recognition is not included; if a barcode cannot be read, the user types the number or searches for the product.
 
---
 
## Status
 
🚧 In development (school project).
 
## Team
 
- _Add names here_

 



