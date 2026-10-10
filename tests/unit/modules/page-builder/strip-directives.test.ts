import { describe, expect, it } from 'vitest';
import { stripAllDirectives } from '@/modules/page-builder/application/strip-directives';

describe('stripAllDirectives', () => {
  it('removes plain directives and reports their names in order', () => {
    expect(stripAllDirectives('<p>a {{widget type="x"}} b {{ media url="y.jpg" }} c</p>')).toEqual({
      html: '<p>a  b  c</p>',
      stripped: ['widget', 'media'],
    });
  });

  it.each([
    ['double quotes', '{{widget template="a}b}}c"}}'],
    ['single quotes', "{{widget template='a}b}}c'}}"],
    ['attribute-encoded quotes', '{{widget template=&quot;a}b}}c&quot;}}'],
  ])('keeps going past `}` inside %s', (_, directive) => {
    expect(stripAllDirectives(`<p>Hola ${directive} mundo</p>`)).toEqual({
      html: '<p>Hola  mundo</p>',
      stripped: ['widget'],
    });
  });

  it('removes several directives with quoted braces in the same content', () => {
    const html = '{{block id="a}"}}x{{widget conditions="{b:1}" type="c"}}y';
    expect(stripAllDirectives(html)).toEqual({ html: 'xy', stripped: ['block', 'widget'] });
  });

  it('leaves text without directives untouched', () => {
    const html = '<p>{ not } a {directive} nor {{ 123 }} one</p>';
    expect(stripAllDirectives(html)).toEqual({ html, stripped: [] });
  });

  it('an unterminated quote falls back to the first closing braces', () => {
    expect(stripAllDirectives('a {{widget title="oops}} b')).toEqual({
      html: 'a  b',
      stripped: ['widget'],
    });
  });

  it('an unterminated directive is left as text', () => {
    const html = 'a {{widget type="x" b';
    expect(stripAllDirectives(html)).toEqual({ html, stripped: [] });
  });
});
