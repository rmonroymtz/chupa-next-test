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

describe('stripAllDirectives quote handling', () => {
  it('ignores quotes inside unquoted arguments and ends at the first closing braces', () => {
    const html = '<p>{{widget type=Foo it\'s}} Mike\'s "shop" {{block id="a"}} end</p>';
    expect(stripAllDirectives(html)).toEqual({
      html: '<p> Mike\'s "shop"  end</p>',
      stripped: ['widget', 'block'],
    });
  });

  it('never swallows later content when a quoted value is not closed in the directive', () => {
    const html = '<p>{{widget title="oops}} She said "hi" to {{block id="b"}} everyone</p>';
    expect(stripAllDirectives(html)).toEqual({
      html: '<p> She said "hi" to  everyone</p>',
      stripped: ['widget', 'block'],
    });
  });

  it('a stray quote after an unclosed value never crosses into the next directive', () => {
    const html = '{{var a="x}}<p>"</p>{{var b="y"}}tail';
    expect(stripAllDirectives(html)).toEqual({
      html: '<p>"</p>tail',
      stripped: ['var', 'var'],
    });
  });

  it('treats a positional quoted argument as a value', () => {
    expect(stripAllDirectives('a {{trans "Total }} %1"}} b')).toEqual({
      html: 'a  b',
      stripped: ['trans'],
    });
  });

  it('strips block constructs and their closing tags', () => {
    expect(stripAllDirectives('a{{depend x}}b{{/depend}}c{{if y}}d{{else}}e{{/if}}f')).toEqual({
      html: 'abcdef',
      stripped: ['depend', 'depend', 'if', 'else', 'if'],
    });
  });
});

describe('stripAllDirectives only recognizes Magento directives', () => {
  it('keeps literal double-brace text that is not a Magento directive', () => {
    const html = '<p>Usa {{text}} o {{nombre del producto}} aquí {{media url="a.png"}}</p>';
    expect(stripAllDirectives(html)).toEqual({
      html: '<p>Usa {{text}} o {{nombre del producto}} aquí </p>',
      stripped: ['media'],
    });
  });

  it('matches directive names case-insensitively', () => {
    expect(stripAllDirectives('a{{Widget type="x"}}b')).toEqual({
      html: 'ab',
      stripped: ['widget'],
    });
  });
});
