import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Structural guard for the DS token migration (T1, `a815c0e`): the legacy
 * ch-theme tokens were removed from `src/app/globals.css`, so any utility or
 * `var()` that still names one silently renders nothing. Third-party
 * `marketplace-*` colors and the DS `ds-*` namespace are not legacy.
 */
const ROOT = join(import.meta.dirname, '../../../src');
const SOURCE = /\.(?:tsx?|css|m?js)$/;

// Utility prefixes that take a color (Tailwind v4), with optional variants and `-` negation.
const COLOR_UTILITY =
  '(?:bg|text|border(?:-[trblxyse])?|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|divide|placeholder|accent|caret|shadow|inset-shadow)';
const LEGACY_COLOR =
  '(?:brand-[a-z0-9-]+|ch-[a-z0-9-]+|feedback-[a-z-]+|accent-decoration-orange|neutral-(?:background|black|black-base|dark-grey|grey|inactive|medium-grey|medium-grey-dark|white))';
const START = '(?<![\\w-])';
const END = '(?![\\w-])';

const LEGACY: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
  {
    name: 'legacy color utility',
    pattern: new RegExp(`${START}${COLOR_UTILITY}-${LEGACY_COLOR}${END}`, 'g'),
  },
  { name: 'legacy color variable', pattern: new RegExp(`--color-${LEGACY_COLOR}${END}`, 'g') },
  {
    name: 'legacy container',
    pattern: new RegExp(`(?:--container-site|${START}(?:max-w|min-w|w)-site)${END}`, 'g'),
  },
  {
    name: 'legacy radius',
    pattern: new RegExp(
      `(?:--radius-(?:box|input|button|badge|xl|2xl|3xl)|${START}rounded(?:-[trblse]{1,2})?-(?:box|input|button|badge|xl|2xl|3xl))${END}`,
      'g',
    ),
  },
  {
    name: 'legacy shadow',
    pattern: new RegExp(`(?:--shadow-header|${START}shadow-header)${END}`, 'g'),
  },
  {
    name: 'legacy font',
    pattern: new RegExp(
      `(?:--font-(?:montserrat|noto|roboto)|--next-font-(?:montserrat|noto-sans)|${START}font-(?:montserrat|noto|roboto))${END}`,
      'g',
    ),
  },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return SOURCE.test(entry.name) ? [path] : [];
  });
}

export function findLegacyTokens(text: string): string[] {
  return LEGACY.flatMap(({ name, pattern }) =>
    [...text.matchAll(pattern)].map((match) => `${name}: ${match[0]}`),
  );
}

describe('legacy design tokens', () => {
  it('flags removed names and ignores the DS and marketplace names', () => {
    expect(
      findLegacyTokens(
        'bg-brand-red hover:text-ch-text border-feedback-error text-neutral-dark-grey max-w-site rounded-box rounded-t-button shadow-header font-montserrat var(--color-brand-darkest) var(--font-noto)',
      ),
    ).toHaveLength(11);
    expect(
      findLegacyTokens(
        'bg-ds-cta text-ds-neutral-800 bg-marketplace-home-depot rounded-pill rounded-xs shadow-elevation-1 font-display var(--color-ds-accent) --pb-brand-darkest bg-ds-surface-brand',
      ),
    ).toEqual([]);
  });

  it('src references none of the removed T1 tokens', () => {
    const offenders = sourceFiles(ROOT).flatMap((file) =>
      findLegacyTokens(readFileSync(file, 'utf8')).map((hit) => `${relative(ROOT, file)} → ${hit}`),
    );
    expect(offenders).toEqual([]);
  });
});
