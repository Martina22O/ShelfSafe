import React from 'react';
import NewProductClient from './NewProductClient';

interface NewProductPageProps {
  searchParams: Promise<{ barcode?: string }>;
}

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
  const resolvedParams = await searchParams;
  const initialBarcode = resolvedParams?.barcode ? String(resolvedParams.barcode) : '';

  return <NewProductClient initialBarcode={initialBarcode} />;
}

