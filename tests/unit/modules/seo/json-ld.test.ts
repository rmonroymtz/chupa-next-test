import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from '@/modules/seo/domain/json-ld';

describe('serializeJsonLd', () => {
  it('cannot close the surrounding <script> element or open a comment', () => {
    const output = serializeJsonLd({ name: '</script><script>alert(1)</script><!--' });

    expect(output).not.toMatch(/[<>]/);
    expect(output).not.toContain('</script');
    expect(JSON.parse(output)).toEqual({ name: '</script><script>alert(1)</script><!--' });
  });

  it('escapes &, > and the JavaScript line separators while staying valid JSON', () => {
    const value = { text: 'a & b > c \u2028 d \u2029 e' };
    const output = serializeJsonLd(value);

    expect(output).not.toMatch(/[&>\u2028\u2029]/);
    expect(JSON.parse(output)).toEqual(value);
  });

  it('drops undefined properties', () => {
    expect(serializeJsonLd({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});
