'use client';
import { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { btb } from './design-tokens';
import { Icon } from './Icon';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'success' | 'successSoft' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  /** Optional Icon name rendered before the label. */
  icon?: string;
  /** Renders an <a> instead of a <button>, styled identically. */
  href?: string;
  /** Only meaningful alongside href. */
  target?: string;
  children?: ReactNode;
  style?: CSSProperties;
}

const SIZES: Record<Size, { height: number; radius: number; fontSize: number; padding: number }> = {
  sm: { height: 44, radius: 14, fontSize: 14, padding: 16 },
  md: { height: 56, radius: 18, fontSize: 16, padding: 20 },
  lg: { height: 60, radius: 22, fontSize: 17, padding: 24 },
};

/** Visuals per variant when the button is active (enabled). */
function activeVisual(variant: Variant): CSSProperties {
  switch (variant) {
    case 'success':
      return {
        background: btb.gradGreen,
        color: '#fff',
        boxShadow: '0 8px 20px rgba(82,227,164,0.3)',
      };
    case 'successSoft':
      // Green identity without the weight of a solid fill — for secondary
      // actions that should still read as part of the brand.
      return {
        background: 'rgba(82,227,164,0.12)',
        color: btb.green,
        border: '1px solid rgba(82,227,164,0.32)',
      };
    case 'ghost':
      return {
        background: 'rgba(255,255,255,0.06)',
        color: btb.textMuted,
        border: btb.borderSoft,
      };
    case 'danger':
      return {
        background: 'rgba(255,107,122,0.15)',
        color: btb.loss,
        border: '1px solid rgba(255,107,122,0.4)',
      };
    case 'primary':
    default:
      return {
        background: btb.gradPrimary,
        color: btb.bg,
        boxShadow: '0 10px 30px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.3)',
      };
  }
}

/**
 * The one button used everywhere — replaces the ~48 hand-styled <button>s that
 * each re-declared the same gradient / radius / loading-spinner code.
 */
export function Button({
  variant = 'primary',
  size = 'lg',
  fullWidth = true,
  loading = false,
  icon,
  href,
  target,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const dims = SIZES[size];
  const isDisabled = disabled || loading;
  const visual = isDisabled
    ? { background: 'rgba(255,255,255,0.07)', color: btb.textDim, border: 'none' as const, boxShadow: 'none' }
    : activeVisual(variant);
  // Spinner/icon colors track the resolved text color — including a caller's
  // override — so a recoloured button doesn't keep a mismatched glyph.
  const fg = (style?.color as string) ?? (visual.color as string) ?? '#fff';

  const shared: CSSProperties = {
    width: fullWidth ? '100%' : undefined,
    height: dims.height,
    // Auto-width buttons must be inline-flex: `display: flex` is block-level, so
    // one on its own would stretch the full width of its parent.
    display: fullWidth ? 'flex' : 'inline-flex',
    // The <a> variant gets no user-agent button padding, so state it explicitly
    // rather than depending on the element type.
    padding: `0 ${dims.padding}px`,
    borderRadius: dims.radius,
    border: 'none',
    cursor: isDisabled ? 'default' : 'pointer',
    fontSize: dims.fontSize,
    fontWeight: 700,
    fontFamily: 'inherit',
    letterSpacing: -0.2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.2s, transform 0.1s',
    opacity: loading ? 0.85 : 1,
    ...visual,
    ...style,
  };

  const content = (
    <>
      {loading ? <Spinner size={18} color={fg} track="rgba(255,255,255,0.25)" /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      {children}
    </>
  );

  // A link still has to be an <a> for target/rel and middle-click to work, so
  // it shares the style object rather than the element.
  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={target === '_blank' ? 'noreferrer' : undefined}
        style={shared}
        onClick={rest.onClick as React.MouseEventHandler<HTMLAnchorElement> | undefined}
      >
        {content}
      </a>
    );
  }

  return (
    <button {...rest} disabled={isDisabled} style={shared}>
      {content}
    </button>
  );
}
