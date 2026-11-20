import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import {
  CupSoda,
  Container,
  Cookie,
  Soup,
  Flame,
  Milk,
  Pill,
  Package,
} from 'lucide-react-native';
import { COLORS } from '../theme';

interface ProductCategoryIconProps {
  categoryName?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export default function ProductCategoryIcon({
  categoryName,
  size = 32,
  style,
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

  const iconColor = isKnownCategory ? COLORS.primary : COLORS.textMuted;
  const containerBg = isKnownCategory ? COLORS.primaryLight : COLORS.bgCard;
  const containerBorder = isKnownCategory ? COLORS.primaryBorder : COLORS.border;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: containerBg,
          borderColor: containerBorder,
        },
        style,
      ]}
    >
      <IconComponent size={size} color={iconColor} strokeWidth={1.8} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
