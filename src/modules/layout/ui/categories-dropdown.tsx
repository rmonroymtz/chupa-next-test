import { Icon } from '@/shared/ui/icon';

/**
 * Same footprint as the desktop "Categorías" button while the menu streams in
 * (invisible, so the row does not shift when the real button arrives). Also
 * what remains when the menu is unavailable: nothing to open.
 */
export function CategoriesDropdownPlaceholder() {
  return (
    <span
      aria-hidden="true"
      className="invisible hidden h-10 shrink-0 items-center gap-1.5 text-body-md font-semibold whitespace-nowrap lg:inline-flex"
    >
      <Icon name="menu" size={18} />
      Categorías
    </span>
  );
}
