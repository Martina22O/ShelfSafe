import React, { Suspense } from 'react';
import { StoreSettingsProvider } from '../../context/StoreSettingsContext';
import { RealtimeProvider } from '../../lib/realtime';
import { AppShell } from '../../components/AppShell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StoreSettingsProvider>
      <RealtimeProvider>
        <Suspense fallback={<div className="min-h-screen bg-gray-50 p-6 text-sm text-gray-500">Loading...</div>}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </RealtimeProvider>
    </StoreSettingsProvider>
  );
}
