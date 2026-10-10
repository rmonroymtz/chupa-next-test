/** Result of removing every Magento template directive from content. */
export interface StrippedDirectives {
  readonly html: string;
  /** Lower-cased directive names that were removed, in order of appearance. */
  readonly stripped: readonly string[];
}

const DIRECTIVE_START = /\{\{\s*([a-zA-Z_]+)/g;
// Quote tokens inside directive arguments, longest first (attribute-encoded `&quot;`).
const QUOTES = ['&quot;', '"', "'"] as const;

/**
 * Removes every `{{name ...}}` directive, scanning the arguments so a `}` (or
 * `}}`) inside a quoted value does not end the directive early. A regex such
 * as `\{\{[^}]*\}\}` misses those directives and would leave them visible to
 * shoppers. Directives without closing braces are not directives and stay as
 * text; an unterminated quote falls back to the first closing braces.
 */
export function stripAllDirectives(html: string): StrippedDirectives {
  const stripped: string[] = [];
  let output = '';
  let cursor = 0;
  DIRECTIVE_START.lastIndex = 0;
  for (let match = DIRECTIVE_START.exec(html); match !== null; match = DIRECTIVE_START.exec(html)) {
    const start = match.index;
    if (start < cursor) continue;
    const end = findDirectiveEnd(html, start + match[0].length);
    if (end === -1) continue;
    output += html.slice(cursor, start);
    stripped.push(match[1]!.toLowerCase());
    cursor = end;
    DIRECTIVE_START.lastIndex = end;
  }
  return { html: output + html.slice(cursor), stripped };
}

/** Index just past the closing `}}`, or -1 when the directive never closes. */
function findDirectiveEnd(html: string, from: number): number {
  let quote: string | null = null;
  for (let index = from; index < html.length;) {
    if (quote) {
      if (html.startsWith(quote, index)) {
        index += quote.length;
        quote = null;
      } else {
        index += 1;
      }
      continue;
    }
    if (html.startsWith('}}', index)) return index + 2;
    const opening = QUOTES.find((token) => html.startsWith(token, index));
    if (opening) {
      quote = opening;
      index += opening.length;
    } else {
      index += 1;
    }
  }
  // Unterminated quote: treat the first closing braces after the name as the end.
  const fallback = quote ? html.indexOf('}}', from) : -1;
  return fallback === -1 ? -1 : fallback + 2;
}
