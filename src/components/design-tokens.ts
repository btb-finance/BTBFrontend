export const btb = {
  glass:       'rgba(255,255,255,0.06)',
  glassStrong: 'rgba(255,255,255,0.10)',
  glassSoft:   'rgba(255,255,255,0.03)',
  border:      '1px solid rgba(255,255,255,0.12)',
  borderSoft:  '1px solid rgba(255,255,255,0.07)',
  text:        '#FFFFFF',
  textMuted:   'rgba(255,255,255,0.55)',
  textDim:     'rgba(255,255,255,0.35)',
  red:         '#FFFFFF',
  redDeep:     'rgba(255,255,255,0.7)',
  pink:        '#FFFFFF',
  amber:       '#FFB36B',
  green:       '#52E3A4',
  loss:        '#FF6B7A',
  shadow:      '0 8px 32px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.06) inset',
  blur:        'blur(32px) saturate(140%)',
} as const;

export const PALETTE_PRESETS = {
  ember:   { name: 'Minimal', colors: ['#0A0A0F', '#111118', '#1E2030', '#2D3048'] },
  crimson: { name: 'Dark',    colors: ['#080810', '#0F0F18', '#1A1A28', '#252538'] },
  magenta: { name: 'Magenta', colors: ['#26031C', '#7A0F4E', '#FF3B6A', '#FF9CC2'] },
  sunset:  { name: 'Sunset',  colors: ['#2D0610', '#3A2A9A', '#FF6B47', '#FFC36B'] },
  ruby:    { name: 'Ruby',    colors: ['#190209', '#680B1E', '#E0142F', '#FF7A8A'] },
} as const;

export type PaletteKey = keyof typeof PALETTE_PRESETS;
