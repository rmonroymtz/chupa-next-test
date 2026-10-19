import type { HTMLAttributes } from 'react';
import { cx } from './class-names';

/** V3 manual C2 "Badges de Producto": each colour carries a fixed meaning. */
export type BadgeVariant =
  'new' | 'sale' | 'featured' | 'soldout' | 'shipping' | 'lastunits' | 'neutral';

const VARIANTS: Record<BadgeVariant, string> = {
  /** NUEVO, recent product (< 30 days), #10B981. */
  new: 'bg-ds-green text-ds-text-inverse',
  /** OFERTA, active discount, #D84752. */
  sale: 'bg-ds-accent text-ds-text-inverse',
  /** DESTACADO, editorial pick, #FDAA40. */
  featured: 'bg-ds-amber text-ds-text-inverse',
  /** AGOTADO, no stock, #AAAAAA. */
  soldout: 'bg-ds-text-tertiary text-ds-text-inverse',
  /** ENVÍO GRATIS, free shipping, #0C7BB2. */
  shipping: 'bg-ds-teal text-ds-text-inverse',
  /** ÚLTIMAS UNIDADES, critical stock (< 5), #F96304. */
  lastunits: 'bg-ds-orange text-ds-text-inverse',
  /** Generic label outside C2. */
  neutral: 'bg-ds-surface-muted text-ds-text-secondary',
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  readonly variant?: BadgeVariant;
};

/** DS Badge: product status label, `radius-xs` (DS "Forma" rule, not a pill). */
export function Badge({ variant = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cx(
        'inline-flex items-center gap-1 rounded-xs px-2.5 py-[5px] text-[11px] leading-none font-bold tracking-[0.04em] uppercase',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
