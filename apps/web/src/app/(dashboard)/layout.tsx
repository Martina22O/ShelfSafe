import React from 'react';
import { StoreSettingsProvider } from '../../context/StoreSettingsContext';
import { AppShell } from '../../components/AppShell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StoreSettingsProvider>
      <AppShell>{children}</AppShell>
    </StoreSettingsProvider>
  );
}

