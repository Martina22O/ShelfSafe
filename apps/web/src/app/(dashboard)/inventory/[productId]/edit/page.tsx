import React from 'react';
import { EditProductClient } from './EditProductClient';

interface EditProductPageProps {
  params: Promise<{ productId: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const resolvedParams = await params;
  const productId = resolvedParams.productId;

  return <EditProductClient productId={productId} />;
}

