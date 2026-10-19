import { Icon } from '@/shared/ui/icon';

/** Same footprint as the mobile menu button while the menu streams in. */
export function NavDrawerPlaceholder() {
  return (
    <span
      aria-hidden="true"
      className="invisible inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-2 lg:hidden"
    >
      <Icon name="menu" size={22} />
      <span className="hidden text-body-md font-semibold whitespace-nowrap md:inline">
        Categorías
      </span>
    </span>
  );
}
