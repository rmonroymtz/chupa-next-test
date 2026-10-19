import type { SVGProps } from 'react';
import { Icon } from '@/shared/ui/icon';

/*
 * Legacy icon names kept for the category navigation, delegating to the DS
 * `Icon` (inline SVG, `currentColor`, `aria-hidden`: the control that holds
 * them carries the accessible name). The legacy user and search glyphs were
 * retired with the DS header (it uses `Icon` directly).
 */
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

/*
 * The call sites size these with classes (`size-4`...), which win over the
 * DS default `width`/`height` attributes.
 */
type DsIconProps = Omit<IconProps, 'width' | 'height' | 'role' | 'name' | 'strokeWidth'>;

/** DS `menu` (the Venia `navTrigger` feather glyph), legacy 2px stroke. */
export function MenuIcon(props: DsIconProps) {
  return <Icon name="menu" strokeWidth={2} {...props} />;
}

/** DS `chevron-down` (feather, as in the legacy megamenu item), legacy 2px stroke. */
export function ChevronDownIcon(props: DsIconProps) {
  return <Icon name="chevron-down" strokeWidth={2} {...props} />;
}
