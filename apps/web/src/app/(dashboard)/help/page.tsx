import React from 'react';
import {
  Boxes,
  Layers,
  ScanBarcode,
  RotateCcw,
  Clock,
  Archive,
  KeyRound,
  Radio,
} from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="space-y-6 w-full">
      <div className="pb-2 border-b border-[#ece3d2]/80">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-black text-[#181413] tracking-tight">Help &amp; Knowledge Base</h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#fef9f0] text-[#7a7469] border border-[#ece3d2]">
            8 Guides
          </span>
        </div>
        <p className="text-xs text-[#7a7469] mt-1">
          Learn how inventory tracking, batches, sales deductions, and store settings work in ShelfSafe.
        </p>
      </div>

      <div className="space-y-4 w-full">
        {/* Q1: How to add stock */}
        <section className="w-full bg-white border border-[#ece3d2] rounded-2xl p-6 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-[#207429]">
            <Layers className="w-5 h-5 shrink-0" />
            <h2 className="text-sm font-bold text-[#181413]">
              How do I add stock?
            </h2>
          </div>
          <p className="text-xs text-[#524c40] leading-relaxed">
            Go to the Inventory page and select &quot;Add Stock&quot;, or click &quot;New Product&quot; if the item has not been registered yet. Every stock entry creates a batch where you provide the quantity received, purchase date, and expiration date.
          </p>
        </section>

        {/* Q2: Batches & Expiry Tracking */}
        <section className="w-full bg-white border border-[#ece3d2] rounded-2xl p-6 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-[#207429]">
            <Boxes className="w-5 h-5 shrink-0" />
            <h2 className="text-sm font-bold text-[#181413]">
              What are batches and how does expiration-based stock tracking work?
            </h2>
          </div>
          <p className="text-xs text-[#524c40] leading-relaxed">
            Instead of treating all units of a product as identical, ShelfSafe tracks stock by batches based on expiration date. When a sale is recorded, units are automatically deducted from the batch that expires earliest.
          </p>
          <div className="bg-[#fef9f0] border border-[#ece3d2] rounded-xl p-3 text-xs text-[#524c40]">
            <span className="font-bold text-[#181413]">Example: </span>
            If you have a batch of 5 units expiring in October and another batch of 50 units expiring in December, a sale of 7 units will automatically deduct all 5 units from the October batch and the remaining 2 units from the December batch.
          </div>
        </section>

        {/* Q3: Why barcode scanning & recording sales are in mobile */}
        <section className="w-full bg-white border border-[#ece3d2] rounded-2xl p-6 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-[#207429]">
            <ScanBarcode className="w-5 h-5 shrink-0" />
            <h2 className="text-sm font-bold text-[#181413]">
              Why are barcode scanning and recording sales in the mobile app?
            </h2>
          </div>
          <p className="text-xs text-[#524c40] leading-relaxed">
            Barcode scanning and sales checkouts are built into the mobile application to leverage your mobile device&apos;s camera for rapid point-of-sale checkout at the counter. The web dashboard is designed for administrative workflows: inventory adjustments, history review, reports, and store settings.
          </p>
        </section>

        {/* Q4: How to undo a wrong sale */}
        <section className="w-full bg-white border border-[#ece3d2] rounded-2xl p-6 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-[#207429]">
            <RotateCcw className="w-5 h-5 shrink-0" />
            <h2 className="text-sm font-bold text-[#181413]">
              How do I undo an accidental sale?
            </h2>
          </div>
          <p className="text-xs text-[#524c40] leading-relaxed">
            Open the History page in either the web application or mobile app. Each recorded sale has an &quot;Undo&quot; button. Clicking it prompts for confirmation, then restores the exact number of units back into the same batches they were originally taken from.
          </p>
        </section>

        {/* Q5: Near expiry definition & where to change */}
        <section className="w-full bg-white border border-[#ece3d2] rounded-2xl p-6 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-[#207429]">
            <Clock className="w-5 h-5 shrink-0" />
            <h2 className="text-sm font-bold text-[#181413]">
              What does &quot;Near Expiry&quot; mean and where can I change the threshold?
            </h2>
          </div>
          <p className="text-xs text-[#524c40] leading-relaxed">
            Products are marked near expiry when they expire within your configured threshold of days (default is 7 days). You can adjust this window from 1 to 60 days on the Profile page under Notification preferences.
          </p>
        </section>

        {/* Q6: What archived products are */}
        <section className="w-full bg-white border border-[#ece3d2] rounded-2xl p-6 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-[#207429]">
            <Archive className="w-5 h-5 shrink-0" />
            <h2 className="text-sm font-bold text-[#181413]">
              What are archived products?
            </h2>
          </div>
          <p className="text-xs text-[#524c40] leading-relaxed">
            Archiving a product hides it and its batches from active inventory counts and alerts without deleting sales history or audit records. If you undo a sale for a product or batch that had been archived, ShelfSafe automatically restores it to active status.
          </p>
        </section>

        {/* Q7: Password reset by email note */}
        <section className="w-full bg-white border border-[#ece3d2] rounded-2xl p-6 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-[#207429]">
            <KeyRound className="w-5 h-5 shrink-0" />
            <h2 className="text-sm font-bold text-[#181413]">
              How do I reset my password?
            </h2>
          </div>
          <p className="text-xs text-[#524c40] leading-relaxed">
            Password reset by email is not available yet. If you know your current password, you can change your password directly in the Profile page while signed in.
          </p>
        </section>

        {/* Q8: Live updates across devices */}
        <section className="w-full bg-white border border-[#ece3d2] rounded-2xl p-6 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-[#207429]">
            <Radio className="w-5 h-5 shrink-0" />
            <h2 className="text-sm font-bold text-[#181413]">
              Does ShelfSafe update live when stock changes on another device?
            </h2>
          </div>
          <p className="text-xs text-[#524c40] leading-relaxed">
            Yes. The web dashboard listens for live changes to products, batches, sales, and store settings made from other devices or the mobile app and updates automatically without a page reload. An active internet connection is required for live updates.
          </p>
        </section>
      </div>
    </div>
  );
}