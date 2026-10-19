import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react';
import { cx } from './class-names';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';
/** V3 "botones" heights: xs 24 · sm 32 · md 40 · lg 48 · xl 56 px. */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface CommonProps {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly disabled?: boolean;
  /** Shows a spinner over the label (same width), sets `aria-busy` and blocks clicks. */
  readonly loading?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}

type NativeButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    readonly href?: never;
  };

type LinkButtonProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps | 'href'> & {
    readonly href: string;
    /**
     * Render a plain `<a>` even for an internal path: for pages the edge
     * routes elsewhere (PWA Studio cart/checkout) or that must not be
     * client-navigated.
     */
    readonly nativeAnchor?: boolean;
  };

export type ButtonProps = NativeButtonProps | LinkButtonProps;

const BASE =
  'relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-pill border font-semibold leading-none whitespace-nowrap select-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus';

/** Label sizes from the V3 board §01B: 12 · 13 · 14 · 16 · 16 px. */
const SIZES: Record<ButtonSize, string> = {
  xs: 'h-6 px-3 text-[12px]',
  sm: 'h-8 px-4 text-[13px]',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
  xl: 'h-14 px-8 text-base',
};

/*
 * Red rule: the primary fill is `ds-cta` (#BE424B) with hover/pressed steps.
 * Secondary and tertiary text uses `ds-link` (#BE424B) rather than the DS
 * source's brand anchor #D84752, which is under 4.5:1 on white for 13–16px
 * labels (T1 decision: interactive text is `ds-link`).
 */
const VARIANTS: Record<ButtonVariant, { readonly idle: string; readonly disabled: string }> = {
  primary: {
    idle: 'border-transparent bg-ds-cta text-ds-text-on-cta hover:bg-ds-cta-hover active:bg-ds-cta-pressed',
    disabled: 'border-transparent bg-ds-disabled text-ds-text-on-cta',
  },
  secondary: {
    idle: 'border-ds-link bg-ds-surface text-ds-link hover:bg-ds-primary-50 active:bg-ds-primary-100',
    disabled: 'border-ds-border bg-ds-surface text-ds-disabled',
  },
  tertiary: {
    idle: 'border-transparent bg-transparent text-ds-link hover:bg-ds-primary-50 active:bg-ds-primary-100',
    disabled: 'border-transparent bg-transparent text-ds-disabled',
  },
};

/** Loading keeps the idle colours (minus hover/pressed), as in the DS. */
const stripStates = (classes: string): string =>
  classes
    .split(' ')
    .filter((name) => !name.startsWith('hover:') && !name.startsWith('active:'))
    .join(' ');

const isInternal = (href: string): boolean => href.startsWith('/') && !href.startsWith('//');

function Spinner() {
  return (
    <svg
      data-slot="spinner"
      className="absolute size-[1em] animate-spin motion-reduce:animate-[spin_2s_linear_infinite]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  );
}

/**
 * DS Button (V3 "botones"): pill, token-driven, states in CSS. Renders a
 * `<button>` (default `type="button"`) or, with `href`, a link: `next/link`
 * (without prefetch) for internal paths, a plain `<a>` for external urls or
 * `nativeAnchor`. A disabled or loading link drops its `href`.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  const palette = VARIANTS[variant];
  const classes = cx(
    BASE,
    SIZES[size],
    loading
      ? cx(stripStates(palette.idle), 'cursor-wait')
      : disabled
        ? cx(palette.disabled, 'cursor-not-allowed')
        : palette.idle,
    className,
  );
  const content = (
    <>
      {loading ? <Spinner /> : null}
      <span
        data-slot="label"
        className={cx('inline-flex items-center gap-2', loading && 'opacity-0')}
      >
        {children}
      </span>
    </>
  );

  if ('href' in rest && rest.href !== undefined) {
    const { href, nativeAnchor = false, ...anchor } = rest;
    if (disabled || loading) {
      return (
        <a {...anchor} aria-disabled="true" aria-busy={loading || undefined} className={classes}>
          {content}
        </a>
      );
    }
    if (isInternal(href) && !nativeAnchor) {
      return (
        <Link
          // Same anchor attributes; `exactOptionalPropertyTypes` rejects the optional handlers otherwise.
          {...(anchor as Omit<ComponentProps<typeof Link>, 'href'>)}
          href={href}
          prefetch={false}
          className={classes}
        >
          {content}
        </Link>
      );
    }
    return (
      <a {...anchor} href={href} className={classes}>
        {content}
      </a>
    );
  }

  const { type = 'button', ...button } = rest as Omit<NativeButtonProps, keyof CommonProps>;
  return (
    <button
      {...button}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
    >
      {content}
    </button>
  );
}
