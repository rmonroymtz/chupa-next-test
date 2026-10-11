import {
  type DirectiveMatch,
  replaceDirectives,
  scanDirectives,
} from '@/modules/page-builder/parser/directive-scanner';

/**
 * Magento template directives (`{{media url=...}}`, `{{widget ...}}`).
 *
 * Verified live (2026-10-10): `cmsPage.content` and `cmsBlocks.content` come
 * back already filtered, with absolute media urls and no directives. This is
 * a defensive pass in case a raw directive ever reaches the storefront:
 * `{{media url=}}` is resolved against the store media url, anything else is
 * removed (and reported) rather than shown to shoppers. Directives are found
 * by the quote-aware scanner, so `}` inside quoted arguments is handled and
 * literal double-brace copy (`{{text}}`) is not a directive.
 */

// url=value, url="value", url='value' or url=&quot;value&quot; (attribute-encoded).
const MEDIA_URL = /url\s*=\s*(?:&quot;(.*?)&quot;|"(.*?)"|'(.*?)'|(\S+))/;

export interface DirectiveContext {
  /** Store media base url (`storeConfig.secure_base_media_url`); null when unknown. */
  readonly mediaBaseUrl: string | null;
}

export interface DirectiveResult {
  readonly html: string;
  /** Names of the directives that were removed, in order of appearance. */
  readonly stripped: readonly string[];
}

/** True when the content holds at least one recognized Magento directive. */
export function hasDirectives(html: string): boolean {
  return scanDirectives(html).length > 0;
}

/**
 * Resolves `{{media}}` and removes every other directive. Pass `matches` from
 * an earlier `scanDirectives(html)` to scan the content only once.
 */
export function resolveDirectives(
  html: string,
  context: DirectiveContext,
  matches: readonly DirectiveMatch[] = scanDirectives(html),
): DirectiveResult {
  if (matches.length === 0) return { html, stripped: [] };
  const stripped: string[] = [];
  const resolved = replaceDirectives(
    html,
    ({ name, args }) => {
      if (name === 'media' && context.mediaBaseUrl) {
        const match = MEDIA_URL.exec(args);
        const path = match ? (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '') : '';
        if (path) return joinUrl(context.mediaBaseUrl, path);
      }
      stripped.push(name);
      return '';
    },
    matches,
  );
  return { html: resolved, stripped };
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
