const UNSAFE_CHARACTERS = /[<>&\u2028\u2029]/g;

/**
 * Serializes structured data for an inline `<script type="application/ld+json">`.
 * `<`, `>` and `&` are written as JSON unicode escapes, so no value (product
 * names come from vendor catalogs) can close the script element or open a
 * comment; U+2028/U+2029 are escaped for older JavaScript parsers. The
 * output is still valid JSON with the same value.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(
    UNSAFE_CHARACTERS,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}
