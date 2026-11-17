// Brand colours and sizes used everywhere in the app.
// Orange is for buttons and badges, not for text on a white background.
export const Colors = {
  navy: '#0B1F4B',
  orange: '#F57C00',
  background: '#F7F8FC',
  text: '#1B1F2A',
  success: '#1E8E3E',
  error: '#D93025',
  white: '#FFFFFF',
  textMuted: '#6B7280',
  border: '#E3E6F0',
  navySoft: '#E8ECF7',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Radius = {
  sm: 6,
  md: 8,
  lg: 12,
  pill: 999,
} as const;

export const FontSize = {
  caption: 12,
  body: 14,
  title: 18,
  heading: 22,
} as const;
