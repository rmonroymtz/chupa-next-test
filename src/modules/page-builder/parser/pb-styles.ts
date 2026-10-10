import type { CssStyle, MediaStyle } from '@/modules/page-builder/domain/content-node';

/** Kebab-case declarations, e.g. `{ 'min-height': '300px' }`. */
export type Declarations = Readonly<Record<string, string>>;

/**
 * Styles Magento (2.4.3+) moved out of the content into `<style>` blocks,
 * keyed by `data-pb-style` id. Replaces legacy `convertToInlineStyles`, which
 * needed a browser CSSOM.
 */
export interface PageBuilderStyles {
  readonly base: ReadonlyMap<string, Declarations>;
  readonly media: ReadonlyMap<string, readonly MediaStyle[]>;
}

// `#html-body [data-pb-style=ID]` (optionally quoted), and nothing after it.
const PB_SELECTOR = /^#html-body\s+\[data-pb-style=(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+))\]$/;

/** Parses `prop: value; ...` without breaking on `;` or `:` inside quotes or parentheses. */
export function parseDeclarations(css: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const chunk of splitTopLevel(css, ';')) {
    const colon = chunk.indexOf(':');
    if (colon <= 0) continue;
    const property = chunk.slice(0, colon).trim().toLowerCase();
    const value = chunk
      .slice(colon + 1)
      .replace(/!important\s*$/i, '')
      .trim();
    if (property && value) result[property] = value;
  }
  return result;
}

/** Kebab-case declarations to a React `style` object (custom properties unchanged). */
export function toReactStyle(declarations: Declarations): CssStyle {
  const style: Record<string, string> = {};
  for (const [property, value] of Object.entries(declarations)) {
    style[toCamelCase(property)] = value;
  }
  return style;
}

export function parsePageBuilderStyles(sheets: readonly string[]): PageBuilderStyles {
  const base = new Map<string, Record<string, string>>();
  const media = new Map<string, MediaStyle[]>();

  const addRule = (selectorText: string, body: string, mediaQuery: string | null) => {
    const declarations = parseDeclarations(body);
    for (const selector of selectorText.split(',')) {
      const id = toStyleId(selector);
      if (!id) continue;
      if (mediaQuery === null) {
        base.set(id, { ...base.get(id), ...declarations });
      } else {
        const rules = media.get(id) ?? [];
        rules.push({ media: mediaQuery, declarations });
        media.set(id, rules);
      }
    }
  };

  for (const sheet of sheets) {
    for (const block of readBlocks(stripComments(sheet))) {
      if (block.prelude.startsWith('@media')) {
        const mediaQuery = block.prelude.slice('@media'.length).trim();
        for (const inner of readBlocks(block.body)) addRule(inner.prelude, inner.body, mediaQuery);
      } else if (!block.prelude.startsWith('@')) {
        addRule(block.prelude, block.body, null);
      }
    }
  }
  return { base, media };
}

function toStyleId(selector: string): string | null {
  const match = PB_SELECTOR.exec(selector.trim().replace(/\s+/g, ' '));
  return match ? (match[1] ?? match[2] ?? match[3] ?? null) : null;
}

interface CssBlock {
  readonly prelude: string;
  readonly body: string;
}

/** Top-level `prelude { body }` blocks; tolerant of unbalanced braces. */
function readBlocks(css: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  let index = 0;
  while (index < css.length) {
    const open = css.indexOf('{', index);
    if (open === -1) break;
    let depth = 1;
    let cursor = open + 1;
    while (cursor < css.length && depth > 0) {
      const char = css[cursor];
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      cursor += 1;
    }
    if (depth !== 0) break; // Unterminated block: ignore the rest.
    blocks.push({
      prelude: css
        .slice(index, open)
        .replace(/^[\s}]+/, '')
        .trim(),
      body: css.slice(open + 1, cursor - 1),
    });
    index = cursor;
  }
  return blocks;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth = Math.max(0, depth - 1);
    } else if (char === separator && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function toCamelCase(property: string): string {
  if (property.startsWith('--')) return property;
  const vendor = property.startsWith('-') ? property.slice(1) : null;
  const camel = (vendor ?? property).replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  );
  return vendor ? camel.charAt(0).toUpperCase() + camel.slice(1) : camel;
}
