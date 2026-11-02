import React from 'react';

export default function HelpPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Help &amp; Frequently Asked Questions</h1>
        <p className="text-sm text-gray-600 mt-1">
          Learn how inventory tracking, batches, sales deductions, and store settings work in ShelfSafe.
        </p>
      </div>

      <div className="space-y-4">
        {/* Q1: How to add stock */}
        <section className="bg-white border border-gray-200 rounded p-5 shadow-sm space-y-2">
          <h2 className="text-base font-semibold text-gray-900">
            How do I add stock?
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Go to the Inventory page and select &quot;Add Stock&quot;, or click &quot;New Product&quot; if the item has not been registered yet. Every stock entry creates a batch where you provide the quantity received, purchase date, and expiration date.
          </p>
        </section>

        {/* Q2: Batches & FEFO */}
        <section className="bg-white border border-gray-200 rounded p-5 shadow-sm space-y-2">
          <h2 className="text-base font-semibold text-gray-900">
            What are batches and what does First-Expired-First-Out (FEFO) mean?
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Instead of treating all units of a product as identical, ShelfSafe tracks stock by batches based on expiration date. When a sale is recorded, units are automatically deducted from the batch that expires earliest.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-800">
            <span className="font-semibold text-gray-900">Example:</span> If you have a batch of 5 units expiring in October and another batch of 50 units expiring in December, a sale of 7 units will automatically deduct all 5 units from the October batch and the remaining 2 units from the December batch.
          </div>
        </section>

        {/* Q3: Why barcode scanning & recording sales are in mobile */}
        <section className="bg-white border border-gray-200 rounded p-5 shadow-sm space-y-2">
          <h2 className="text-base font-semibold text-gray-900">
            Why are barcode scanning and recording sales in the mobile app?
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Barcode scanning and sales checkouts are built into the mobile application to leverage your mobile device&apos;s camera for rapid point-of-sale checkout at the counter. The web dashboard is designed for administrative workflows: inventory adjustments, history review, reports, and store settings.
          </p>
        </section>

        {/* Q4: How to undo a wrong sale */}
        <section className="bg-white border border-gray-200 rounded p-5 shadow-sm space-y-2">
          <h2 className="text-base font-semibold text-gray-900">
            How do I undo a wrong sale?
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Open the History page in either the web application or mobile app. Each recorded sale has an &quot;Undo&quot; button. Clicking it prompts for confirmation, then restores the exact number of units back into the same batches they were originally taken from.
          </p>
        </section>

        {/* Q5: Near expiry definition & where to change */}
        <section className="bg-white border border-gray-200 rounded p-5 shadow-sm space-y-2">
          <h2 className="text-base font-semibold text-gray-900">
            What does &quot;Near Expiry&quot; mean and where can I change the threshold?
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Products are marked near expiry when they expire within your configured threshold of days (default is 7 days). You can adjust this window from 1 to 60 days on the Profile page under Notification preferences.
          </p>
        </section>

        {/* Q6: What archived products are */}
        <section className="bg-white border border-gray-200 rounded p-5 shadow-sm space-y-2">
          <h2 className="text-base font-semibold text-gray-900">
            What are archived products?
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Archiving a product hides it and its batches from active inventory counts and alerts without deleting sales history or audit records. If you undo a sale for a product or batch that had been archived, ShelfSafe automatically restores it to active status.
          </p>
        </section>

        {/* Q7: Password reset by email note */}
        <section className="bg-white border border-gray-200 rounded p-5 shadow-sm space-y-2">
          <h2 className="text-base font-semibold text-gray-900">
            How do I reset my password?
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Password reset by email is not available yet. If you know your current password, you can change your password directly in the Profile page while signed in.
          </p>
        </section>
      </div>
    </div>
  );
}

