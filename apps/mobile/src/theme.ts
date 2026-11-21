import { Platform } from 'react-native';

export const SCREEN_PADDING = 20;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 20,
  pill: 999,
} as const;

export const TYPOGRAPHY = {
  pageTitle: 24,
  sectionHeading: 17,
  cardHeading: 16,
  body: 14,
  inputLabel: 14,
  inputText: 15,
  buttonText: 15,
  helperText: 12,
} as const;

export const COLORS = {
  // Brand greens
  primary: '#207429',
  primaryDark: '#185e21',
  primaryLight: '#f4ffe1',
  primaryBorder: '#d6f0b4',
  forestGreen: '#3e8c1f',
  deepGreen: '#254e06',
  accentGreen: '#56a724',

  // Canvas & Backgrounds
  canvas: '#FDFCFA',
  dashboardCanvas: '#FEF7E6',
  scanActionBg: '#FDF7E3',
  bgWarm: '#fef7e6',
  bgContainer: '#fef7e6',
  bgCard: '#fef7e6',
  card: '#ffffff',
  bgTint: '#f4ffe1',

  // Status & Accents
  amber: '#fabe44',
  amberLight: '#fef3c7',
  amberDark: '#b45309',
  amberBorder: '#fde68a',

  orange: '#faab06',
  orangeLight: '#ffedd5',
  orangeDark: '#c2410c',
  orangeBorder: '#fed7aa',

  danger: '#d32f2f',
  dangerLight: '#fee2e2',
  dangerDark: '#991b1b',
  dangerBorder: '#fca5a5',

  // Neutrals & Borders
  border: '#ece3d2',
  borderLight: '#f4f1ea',
  text: '#181413',
  textMuted: '#7a7469',
  textSubtle: '#999182',
  textSecondary: '#7a7469',
  textTertiary: '#999182',
  textInverse: '#ffffff',
  white: '#ffffff',
  tabBarBg: '#254e06',
  tabBarInactive: '#9ec492',
};

export const FONTS = {
  regular: Platform.select({ ios: 'Nunito', android: 'Nunito', default: 'System' }),
  medium: Platform.select({ ios: 'Nunito-Medium', android: 'Nunito-Medium', default: 'System' }),
  semiBold: Platform.select({ ios: 'Nunito-SemiBold', android: 'Nunito-SemiBold', default: 'System' }),
  bold: Platform.select({ ios: 'Nunito-Bold', android: 'Nunito-Bold', default: 'System' }),
  extraBold: Platform.select({ ios: 'Nunito-ExtraBold', android: 'Nunito-ExtraBold', default: 'System' }),
  black: Platform.select({ ios: 'Nunito-Black', android: 'Nunito-Black', default: 'System' }),
};

