'use client';

import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import type { MenuItem } from '@/modules/layout/domain/category-menu';
import { cx } from '@/shared/ui/class-names';
import { Icon } from '@/shared/ui/icon';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-ds-focus';
const ROW_SELECTOR = '[data-category-row]';

/**
 * Desktop "Categorías" dropdown (Figma 536:2918, PWA `CategoriesDropdown`):
 * a floating two-panel disclosure. Left, the top-level categories; right, the
 * active one's title, its subcategories (two columns, filled by column) and
 * "Ver todo en {categoría}". Hover, focus or the arrow keys pick the active
 * category.
 *
 * A disclosure of plain links, not an ARIA menu: Tab walks the links in DOM
 * order, and each category's detail follows its own row, so tabbing from a row
 * enters the subcategories it just revealed. Up/Down/Home/End move between the
 * rows, Right enters the active detail, Left returns to its row. Escape closes
 * and returns focus to the button (unless another layer already handled it); a
 * click outside or focus leaving (also to nothing, as on window blur) closes.
 *
 * The panel is server-rendered with every link (the closed panel and the
 * inactive details are `hidden`), so the category links stay crawlable as they
 * were in the megamenu. Links are plain anchors with today's category urls
 * (full navigation, no prefetch; see `legacy-routes.ts`), not the PWA's
 * `/search.html?query=` targets.
 */
export function CategoriesDropdown({ items }: { readonly items: readonly MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(items[0]?.id);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      // An Escape another layer already handled (the mini cart dialog) is not ours.
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  function rows(): HTMLAnchorElement[] {
    return [...(rootRef.current?.querySelectorAll<HTMLAnchorElement>(ROW_SELECTOR) ?? [])];
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLAnchorElement>, index: number) {
    const all = rows();
    const target = {
      ArrowDown: all[(index + 1) % all.length],
      ArrowUp: all[(index - 1 + all.length) % all.length],
      Home: all[0],
      End: all[all.length - 1],
      ArrowRight: event.currentTarget.nextElementSibling?.querySelector<HTMLAnchorElement>('a'),
    }[event.key];
    if (!target) return;
    event.preventDefault();
    target.focus();
  }

  function onDetailKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft') return;
    const row = event.currentTarget.previousElementSibling;
    if (!(row instanceof HTMLAnchorElement)) return;
    event.preventDefault();
    row.focus();
  }

  // Focus moving outside, or to nothing (window blur, a click on the page
  // background), closes. A click inside never reports null: the root is
  // focusable (`tabIndex={-1}`), so it takes focus for clicks on non-focusable
  // content and, in Safari, on links and buttons.
  function onBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !event.currentTarget.contains(next)) setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="relative hidden shrink-0 outline-none lg:block"
      onBlur={onBlur}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cx(
          'inline-flex h-10 items-center gap-1.5 rounded-xs text-body-md font-semibold whitespace-nowrap text-ds-text hover:text-ds-link focus-visible:outline-offset-2',
          FOCUS_RING,
        )}
      >
        <Icon name="menu" size={18} />
        Categorías
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute top-[calc(100%+0.75rem)] left-0 z-50 w-[46.25rem] overflow-hidden rounded-md border border-ds-border bg-ds-surface shadow-elevation-2"
      >
        {/* Details are positioned against the nav (not the scrolling list),
            so they fill the right column at the panel height. */}
        <nav aria-label="Categorías" className="relative min-h-[22rem]">
          <ul className="max-h-[min(70vh,36rem)] w-66 overflow-y-auto border-r border-ds-border-subtle p-2">
            {items.map((item, index) => {
              const active = item.id === activeId;
              return (
                <li key={item.id}>
                  <a
                    href={item.categoryHref}
                    data-category-row=""
                    onMouseEnter={() => setActiveId(item.id)}
                    onFocus={() => setActiveId(item.id)}
                    onKeyDown={(event) => onRowKeyDown(event, index)}
                    className={cx(
                      'flex items-center gap-3 rounded-sm px-3 py-2 text-body-md text-ds-text transition-colors duration-150 hover:bg-ds-surface-subtle focus-visible:-outline-offset-2',
                      FOCUS_RING,
                      active && 'bg-ds-surface-subtle',
                    )}
                  >
                    <Icon name="grid" size={18} className="shrink-0 text-ds-text-secondary" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <Icon
                      name="chevron-right"
                      size={16}
                      className={cx('shrink-0', active ? 'text-ds-link' : 'text-ds-text-tertiary')}
                    />
                  </a>
                  <div
                    hidden={!active}
                    onKeyDown={onDetailKeyDown}
                    className="absolute inset-y-0 right-0 left-66 overflow-y-auto px-5 py-4"
                  >
                    <a
                      href={item.categoryHref}
                      className={cx(
                        'mb-4 inline-block rounded-xs text-body-lg font-semibold text-ds-link hover:underline',
                        FOCUS_RING,
                      )}
                    >
                      {item.label}
                    </a>
                    {item.children.length > 0 ? (
                      <ul className="mb-4 columns-2 gap-x-6">
                        {item.children.map((child) => (
                          <li key={child.id} className="break-inside-avoid">
                            <a
                              href={child.categoryHref}
                              className={cx(
                                'block rounded-xs py-2 text-body-md text-ds-text transition-colors duration-150 hover:text-ds-link',
                                FOCUS_RING,
                              )}
                            >
                              {child.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <a
                      href={item.categoryHref}
                      className={cx(
                        'inline-flex items-center gap-1 rounded-xs text-body-md font-semibold text-ds-link hover:underline',
                        FOCUS_RING,
                      )}
                    >
                      Ver todo en {item.label}
                      <Icon name="arrow-right" size={16} />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
