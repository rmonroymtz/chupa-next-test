import { replaceDirectives } from '@/modules/page-builder/parser/directive-scanner';

/** Result of removing every Magento template directive from content. */
export interface StrippedDirectives {
  readonly html: string;
  /** Lower-cased directive names that were removed, in order of appearance. */
  readonly stripped: readonly string[];
}

/**
 * Removes every recognized Magento `{{name ...}}` directive (see
 * `MAGENTO_DIRECTIVES`); other double-brace text is shopper copy and stays.
 * The quote-aware scanner keeps a `}` (or `}}`) inside a quoted value from
 * ending the directive early, and never lets a stray quote swallow content
 * past the directive. Directives without closing braces stay as text.
 */
export function stripAllDirectives(html: string): StrippedDirectives {
  const stripped: string[] = [];
  const output = replaceDirectives(html, (match) => {
    stripped.push(match.name);
    return '';
  });
  return { html: output, stripped };
}
