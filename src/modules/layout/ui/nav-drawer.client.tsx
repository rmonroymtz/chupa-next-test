'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { MenuItem } from '@/modules/layout/domain/category-menu';
import { LEGACY_ROUTES } from '@/modules/layout/domain/legacy-routes';
import { cx } from '@/shared/ui/class-names';
import { Icon } from '@/shared/ui/icon';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-ds-focus';
const ROW =
  'flex min-h-14 w-full items-center gap-3 px-5 text-left text-body-lg hover:bg-ds-surface-subtle focus-visible:-outline-offset-2';

/** Every category with subcategories (one drill-down view each), depth first. */
function branchesOf(items: readonly MenuItem[]): MenuItem[] {
  return items.flatMap((item) =>
    item.children.length > 0 ? [item, ...branchesOf(item.children)] : [],
  );
}

/**
 * Mobile/tablet navigation drawer (< 1024), the PWA's light Venia drawer:
 * header with the wordmark and close, the category tree as drill-down views
 * (a category with subcategories opens its own view with "Volver" and
 * "Ver todo en {categoría}"; leaves link to their page), and the account
 * entry at the bottom.
 *
 * A native modal `<dialog>`: `showModal()` makes the page inert (focus trap),
 * Escape fires `cancel`, and focus returns to the menu button on close. The
 * page behind does not scroll while it is open. Every view is server-rendered
 * (the inactive ones `hidden`), so all category links stay in the markup.
 */
export function NavDrawer({ items }: { readonly items: readonly MenuItem[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // The page `overflow` saved while the drawer locks the scroll; null = not locked.
  const overflowRef = useRef<string | null>(null);
  const focusKeyRef = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  // Ids of the opened categories, outermost first; empty = top level.
  const [path, setPath] = useState<readonly string[]>([]);
  const current = path.at(-1);

  useEffect(() => {
    const key = focusKeyRef.current;
    if (key === null) return;
    focusKeyRef.current = null;
    const targets = dialogRef.current?.querySelectorAll<HTMLElement>('[data-focus-key]') ?? [];
    [...targets].find((element) => element.dataset.focusKey === key)?.focus();
  }, [path]);

  // The drawer is the < 1024 navigation: when the viewport grows past it (its
  // button is then hidden), close it and give the page its scroll back.
  useEffect(() => {
    if (!open || typeof window.matchMedia !== 'function') return;
    const desktop = window.matchMedia('(min-width: 1024px)');
    function onChange(event: { readonly matches: boolean }) {
      const dialog = dialogRef.current;
      if (!event.matches || !dialog) return;
      // Same path as the close button: the `close` event runs `onClosed`.
      if (typeof dialog.close === 'function') dialog.close();
      else {
        dialog.removeAttribute('open');
        dialog.dispatchEvent(new Event('close'));
      }
    }
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, [open]);

  function openDrawer(): void {
    const dialog = dialogRef.current;
    if (!dialog) return;
    setPath([]);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    lockScroll();
    setOpen(true);
    closeRef.current?.focus();
  }

  function closeDrawer(): void {
    const dialog = dialogRef.current;
    if (dialog && typeof dialog.close === 'function') dialog.close();
    else {
      dialog?.removeAttribute('open');
      onClosed();
    }
  }

  /** The dialog `close` event: also after the platform closed it. */
  function onClosed(): void {
    unlockScroll();
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Idempotent: a repeated open keeps the first saved value, and a close
  // without an open (or a second close) leaves the page overflow alone.
  function lockScroll(): void {
    if (overflowRef.current !== null) return;
    overflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  function unlockScroll(): void {
    if (overflowRef.current === null) return;
    document.body.style.overflow = overflowRef.current;
    overflowRef.current = null;
  }

  function drillInto(id: string): void {
    focusKeyRef.current = `back:${id}`;
    setPath((value) => [...value, id]);
  }

  function back(): void {
    if (current === undefined) return;
    focusKeyRef.current = `branch:${current}`;
    setPath((value) => value.slice(0, -1));
  }

  function row(item: MenuItem) {
    return (
      <li key={item.id}>
        {item.children.length > 0 ? (
          <button
            type="button"
            data-focus-key={`branch:${item.id}`}
            onClick={() => drillInto(item.id)}
            className={cx(ROW, 'text-ds-text', FOCUS_RING)}
          >
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <Icon name="chevron-right" size={20} className="shrink-0 text-ds-text-tertiary" />
          </button>
        ) : (
          <a href={item.categoryHref} className={cx(ROW, 'text-ds-text', FOCUS_RING)}>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          </a>
        )}
      </li>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openDrawer}
        className={cx(
          'inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-2 rounded-xs text-ds-text hover:text-ds-link focus-visible:outline-offset-2 lg:hidden',
          FOCUS_RING,
        )}
      >
        <Icon name="menu" size={22} />
        {/* Bare hamburger on phones, labeled from 768 (PWA navTrigger). */}
        <span className="sr-only text-body-md font-semibold whitespace-nowrap md:not-sr-only">
          Categorías
        </span>
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Menú"
        aria-modal="true"
        onClose={onClosed}
        onCancel={(event) => {
          event.preventDefault();
          closeDrawer();
        }}
        onClick={(event) => {
          // A click on the backdrop targets the dialog element itself.
          if (event.target === event.currentTarget) closeDrawer();
        }}
        className="fixed inset-y-0 right-auto left-0 m-0 h-dvh max-h-dvh w-full max-w-[24rem] bg-ds-surface p-0 text-ds-text shadow-elevation-3 backdrop:bg-ds-overlay"
      >
        <div className="flex h-full flex-col pb-[env(safe-area-inset-bottom)]">
          <div className="flex h-18 shrink-0 items-center justify-between border-b border-ds-border-subtle px-4">
            <a
              href={LEGACY_ROUTES.home}
              className={cx('rounded-xs focus-visible:outline-offset-2', FOCUS_RING)}
            >
              <Image
                src="/images/layout/logo.svg"
                alt="Chupaprecios"
                width={394}
                height={37}
                className="h-auto w-[125px]"
              />
            </a>
            <button
              ref={closeRef}
              type="button"
              aria-label="Cerrar menú"
              onClick={closeDrawer}
              className={cx(
                'grid size-11 place-items-center rounded-full hover:bg-ds-surface-subtle',
                FOCUS_RING,
              )}
            >
              <Icon name="x" size={22} />
            </button>
          </div>

          <nav aria-label="Menú principal" className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto py-2">
              <ul hidden={current !== undefined}>{items.map(row)}</ul>
              {branchesOf(items).map((branch) => (
                <div key={branch.id} hidden={current !== branch.id}>
                  <div className="flex items-center gap-1 border-b border-ds-border-subtle px-2 pb-2">
                    <button
                      type="button"
                      data-focus-key={`back:${branch.id}`}
                      onClick={back}
                      className={cx(
                        'grid size-11 shrink-0 place-items-center rounded-full hover:bg-ds-surface-subtle',
                        FOCUS_RING,
                      )}
                    >
                      <Icon name="arrow-left" size={20} />
                      <span className="sr-only">Volver</span>
                    </button>
                    <h2 className="min-w-0 truncate text-h4">{branch.label}</h2>
                  </div>
                  <ul>
                    <li>
                      <a
                        href={branch.categoryHref}
                        className={cx(ROW, 'font-semibold text-ds-link', FOCUS_RING)}
                      >
                        Ver todo en {branch.label}
                      </a>
                    </li>
                    {branch.children.map(row)}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex h-16 shrink-0 items-center border-t border-ds-border-subtle px-5">
              <a
                href={LEGACY_ROUTES.signIn}
                className={cx(
                  'inline-flex min-h-11 items-center gap-2 rounded-xs text-body-lg font-semibold text-ds-link hover:underline focus-visible:outline-offset-2',
                  FOCUS_RING,
                )}
              >
                <Icon name="user" size={20} />
                Iniciar sesión
              </a>
            </div>
          </nav>
        </div>
      </dialog>
    </>
  );
}
