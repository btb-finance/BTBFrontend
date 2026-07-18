export const btb = {
  bg:          'var(--chain-bg, #0A0A0F)',
  glass:       'var(--chain-surface, rgba(255,255,255,0.06))',
  glassStrong: 'var(--chain-surface-strong, rgba(255,255,255,0.10))',
  glassSoft:   'var(--chain-surface-soft, rgba(255,255,255,0.03))',
  // Flat translucent-white surfaces (non-blurred) used for chips, inputs, rows.
  surface:     'var(--chain-surface, rgba(255,255,255,0.06))',
  surfaceStrong:'var(--chain-surface-strong, rgba(255,255,255,0.08))',
  surfaceSoft: 'var(--chain-surface-soft, rgba(255,255,255,0.04))',
  border:      'var(--chain-border, 1px solid rgba(255,255,255,0.12))',
  borderSoft:  'var(--chain-border-soft, 1px solid rgba(255,255,255,0.07))',
  text:        '#FFFFFF',
  textMuted:   'rgba(255,255,255,0.55)',
  textDim:     'rgba(255,255,255,0.35)',
  // Keep large text and surfaces neutral; chain color is reserved for compact
  // identity accents such as the selected network logo.
  red:         '#FFFFFF',
  redDeep:     'rgba(255,255,255,0.7)',
  pink:        '#FFFFFF',
  amber:       '#FFB36B',
  green:       '#52E3A4',
  loss:        '#FF6B7A',
  shadow:      'var(--chain-shadow, 0 8px 32px rgba(0,0,0,0.35))',
  blur:        'blur(32px) saturate(140%)',
  // Shared gradients — keep button/CTA fills consistent in one place.
  gradPrimary: 'var(--chain-gradient, linear-gradient(135deg,rgba(255,255,255,0.95),rgba(200,210,220,0.9)))',
  gradGreen:   'linear-gradient(135deg,#52E3A4,#1aad77)',
} as const;

export const PALETTE_PRESETS = {
  ember:   { name: 'Minimal', colors: ['#0A0A0F', '#111118', '#1E2030', '#2D3048'] },
  crimson: { name: 'Dark',    colors: ['#080810', '#0F0F18', '#1A1A28', '#252538'] },
  magenta: { name: 'Magenta', colors: ['#26031C', '#7A0F4E', '#FF3B6A', '#FF9CC2'] },
  sunset:  { name: 'Sunset',  colors: ['#2D0610', '#3A2A9A', '#FF6B47', '#FFC36B'] },
  ruby:    { name: 'Ruby',    colors: ['#190209', '#680B1E', '#E0142F', '#FF7A8A'] },
} as const;

export type PaletteKey = keyof typeof PALETTE_PRESETS;
