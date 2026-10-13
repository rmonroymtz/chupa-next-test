/**
 * Magento template directives (`{{media url=...}}`, `{{widget ...}}`).
 *
 * Verified live (2026-10-10): `cmsPage.content` and `cmsBlocks.content` come
 * back already filtered, with absolute media urls and no directives. This is
 * a defensive pass in case a raw directive ever reaches the storefront:
 * `{{media url=}}` is resolved against the store media url, anything else is
 * removed (and reported) rather than shown to shoppers.
 */

const DIRECTIVE = /\{\{\s*([a-zA-Z_]+)([^}]*)\}\}/g;
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

export function hasDirectives(html: string): boolean {
  return /\{\{\s*[a-zA-Z_]+[^}]*\}\}/.test(html);
}

/** True when resolving needs the store media url. */
export function hasMediaDirective(html: string): boolean {
  return /\{\{\s*media\b/.test(html);
}

export function resolveDirectives(html: string, context: DirectiveContext): DirectiveResult {
  if (!hasDirectives(html)) return { html, stripped: [] };
  const stripped: string[] = [];
  const resolved = html.replace(DIRECTIVE, (_match, rawName: string, args: string) => {
    const name = rawName.toLowerCase();
    if (name === 'media' && context.mediaBaseUrl) {
      const match = MEDIA_URL.exec(args);
      const path = match ? (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '') : '';
      if (path) return joinUrl(context.mediaBaseUrl, path);
    }
    stripped.push(name);
    return '';
  });
  return { html: resolved, stripped };
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
