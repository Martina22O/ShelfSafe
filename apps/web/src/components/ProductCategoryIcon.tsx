'use client';

import React from 'react';
import {
  CupSoda,
  Container,
  Cookie,
  Soup,
  Flame,
  Milk,
  Pill,
  Package,
} from 'lucide-react';

interface ProductCategoryIconProps {
  categoryName?: string | null;
  size?: number;
  className?: string;
}

export function ProductCategoryIcon({
  categoryName,
  size = 32,
  className = '',
}: ProductCategoryIconProps) {
  const norm = (categoryName || '').trim().toLowerCase();

  let IconComponent = Package;
  let isKnownCategory = true;

  if (norm.includes('beverage')) {
    IconComponent = CupSoda;
  } else if (norm.includes('canned')) {
    IconComponent = Container;
  } else if (norm.includes('biscuit') || norm.includes('snack')) {
    IconComponent = Cookie;
  } else if (norm.includes('noodle')) {
    IconComponent = Soup;
  } else if (norm.includes('condiment')) {
    IconComponent = Flame;
  } else if (norm.includes('dairy')) {
    IconComponent = Milk;
  } else if (norm.includes('medicine') || norm.includes('counter')) {
    IconComponent = Pill;
  } else {
    IconComponent = Package;
    isKnownCategory = false;
  }

  const containerBg = isKnownCategory
    ? 'bg-[#f4ffe1] border-[#d6f0b4] text-[#207429]'
    : 'bg-[#fef9f0] border-[#ece3d2] text-[#7a7469]';

  return (
    <div
      className={`rounded-2xl border flex items-center justify-center shrink-0 overflow-hidden ${containerBg} ${className}`}
    >
      <IconComponent style={{ width: size, height: size }} strokeWidth={1.8} />
    </div>
  );
}
