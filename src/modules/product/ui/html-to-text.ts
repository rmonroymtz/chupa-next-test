const BLOCK_TAGS = /<\/?(?:p|div|br|li|ul|ol|h[1-6]|tr|table|section|article)\b[^>]*>/gi;
const DROPPED_ELEMENTS = /<(script|style|template|noscript|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const TAGS = /<[^>]*>/g;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/**
 * Converts untrusted HTML (scraped vendor descriptions) to plain text. The
 * result is rendered as a React text node, so it is escaped on output: even
 * if a malformed fragment survives the stripping it can never become markup.
 */
export function htmlToPlainText(html: string): string {
  const text = html
    .replace(DROPPED_ELEMENTS, '')
    .replace(BLOCK_TAGS, '\n')
    .replace(TAGS, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, decodeEntity);
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n');
}

function decodeEntity(match: string, entity: string): string {
  if (entity.startsWith('#')) {
    const code =
      entity[1] === 'x' || entity[1] === 'X'
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }
  return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
}
