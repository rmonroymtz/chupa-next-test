import type { SVGProps } from 'react';
import { ICONS, type IconName } from './icon-catalog';

export type { IconName } from './icon-catalog';

/** Every glyph in the DS catalog, in catalog order. */
export const iconNames = Object.keys(ICONS) as readonly IconName[];

type IconProps = Omit<
  SVGProps<SVGSVGElement>,
  'children' | 'dangerouslySetInnerHTML' | 'role' | 'width' | 'height'
> & {
  readonly name: IconName;
  /** Width and height in px (the glyphs are drawn on a 24×24 grid). */
  readonly size?: number;
  /** DS default 1.5px; legacy feather glyphs used 2. */
  readonly strokeWidth?: number;
  /** Accessible name. Without it the icon is decorative (`aria-hidden`). */
  readonly title?: string;
};

/**
 * DS Icon: outline glyph whose colour comes from the surrounding text
 * (`currentColor`). Decorative by default, so the control that holds it
 * carries the accessible name; pass `title` for a standalone meaningful icon.
 */
export function Icon({ name, size = 20, strokeWidth = 1.5, title, ...props }: IconProps) {
  const a11y = title
    ? { role: 'img', 'aria-label': title }
    : { 'aria-hidden': true as const, focusable: 'false' as const };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...a11y}
      {...props}
      // Static catalog markup (see icon-catalog.ts), never runtime data.
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
