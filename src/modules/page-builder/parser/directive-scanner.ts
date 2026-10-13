/**
 * Quote-aware scanner for Magento template directives (`{{name args}}`).
 *
 * Only names Magento's template filters actually process are recognized, so
 * literal double-brace copy such as `{{text}}` stays visible. Sources
 * (Magento 2.4): `Framework\Filter\Template` and its directive processors
 * (depend, if/else, for, template, var, legacy), `Email\Model\Template\Filter`
 * (block, config, css, customvar, escapehtml/htmlescape, inlinecss, layout,
 * media, protocol, store, trans, view), `Widget\Model\Template\Filter`
 * (widget). `skin` is the Magento 1 media directive that survives in migrated
 * content. Block constructs close with `{{/name}}`, which is recognized too.
 */
export const MAGENTO_DIRECTIVES: ReadonlySet<string> = new Set([
  'block',
  'config',
  'css',
  'customvar',
  'depend',
  'else',
  'escapehtml',
  'for',
  'htmlescape',
  'if',
  'inlinecss',
  'layout',
  'media',
  'protocol',
  'skin',
  'store',
  'template',
  'trans',
  'var',
  'view',
  'widget',
]);

export interface DirectiveMatch {
  /** Index of the opening `{{`. */
  readonly start: number;
  /** Index just past the closing `}}`. */
  readonly end: number;
  /** Lower-cased directive name (without the `/` of a closing tag). */
  readonly name: string;
  /** Raw text between the name and the closing `}}`. */
  readonly args: string;
}

const DIRECTIVE_START = /\{\{\s*\/?([a-zA-Z_]+)/g;
// Quote tokens, longest first (attribute-encoded `&quot;`).
const QUOTES = ['&quot;', '"', "'"] as const;

/**
 * Every recognized directive in order of appearance.
 *
 * A quote only delimits a value when it opens one: right after `=` (optional
 * whitespace) or as the first positional argument (`{{trans "..."}}`). A
 * value closes on its quote followed by whitespace or `}`. Inside a value
 * `}`/`}}` do not end the directive. The scan never crosses the next `{{`:
 * when no end is found before it (unclosed value, stray quote), the
 * directive ends at its first `}}`; with no `}}` at all it is plain text.
 */
export function scanDirectives(html: string): DirectiveMatch[] {
  const matches: DirectiveMatch[] = [];
  const pattern = new RegExp(DIRECTIVE_START.source, 'g');
  for (let found = pattern.exec(html); found !== null; found = pattern.exec(html)) {
    const name = found[1]!.toLowerCase();
    if (!MAGENTO_DIRECTIVES.has(name)) continue;
    const argsStart = found.index + found[0].length;
    const end = findDirectiveEnd(html, argsStart);
    if (end === -1) continue;
    matches.push({ start: found.index, end, name, args: html.slice(argsStart, end - 2) });
    pattern.lastIndex = end;
  }
  return matches;
}

/** Replaces every recognized directive with `replace(match)`. */
export function replaceDirectives(
  html: string,
  replace: (match: DirectiveMatch) => string,
): string {
  let output = '';
  let cursor = 0;
  for (const match of scanDirectives(html)) {
    output += html.slice(cursor, match.start) + replace(match);
    cursor = match.end;
  }
  return output + html.slice(cursor);
}

/** Index just past the closing `}}`, or -1 when the directive never closes. */
function findDirectiveEnd(html: string, from: number): number {
  const nextStart = html.indexOf('{{', from);
  const limit = nextStart === -1 ? html.length : nextStart;
  const quoted = scanQuoted(html, from, limit);
  if (quoted !== -1) return quoted;
  const plain = html.indexOf('}}', from);
  return plain === -1 || plain + 2 > limit ? -1 : plain + 2;
}

function scanQuoted(html: string, from: number, limit: number): number {
  let quote: string | null = null;
  // A value may open at the first positional argument or right after `=`.
  let valueExpected = true;
  for (let index = from; index < limit;) {
    if (quote) {
      if (html.startsWith(quote, index) && closesValue(html, index + quote.length)) {
        index += quote.length;
        quote = null;
        valueExpected = false;
      } else {
        index += 1;
      }
      continue;
    }
    if (html.startsWith('}}', index)) return index + 2 <= limit ? index + 2 : -1;
    const char = html[index]!;
    const opening = valueExpected
      ? QUOTES.find((token) => html.startsWith(token, index))
      : undefined;
    if (opening) {
      quote = opening;
      index += opening.length;
      continue;
    }
    if (char === '=') valueExpected = true;
    else if (!/\s/.test(char)) valueExpected = false;
    index += 1;
  }
  return -1;
}

function closesValue(html: string, after: number): boolean {
  const next = html[after];
  return next === undefined || next === '}' || /\s/.test(next);
}
