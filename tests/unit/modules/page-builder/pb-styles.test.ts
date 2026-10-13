import { describe, expect, it } from 'vitest';
import {
  parseDeclarations,
  parsePageBuilderStyles,
  toReactStyle,
} from '@/modules/page-builder/parser/pb-styles';

describe('parseDeclarations', () => {
  it('parses kebab-case declarations, lowercasing property names', () => {
    expect(parseDeclarations('Min-Height: 300px; background-color:#fff ;;  ')).toEqual({
      'min-height': '300px',
      'background-color': '#fff',
    });
  });

  it('keeps colons inside values (urls, data uris)', () => {
    expect(parseDeclarations('background-image:url(https://a.test/x.png)')).toEqual({
      'background-image': 'url(https://a.test/x.png)',
    });
  });

  it('keeps semicolons inside quoted strings and parentheses', () => {
    expect(
      parseDeclarations(`background-image:url("data:image/svg+xml;utf8,<svg/>");color:red`),
    ).toEqual({
      'background-image': 'url("data:image/svg+xml;utf8,<svg/>")',
      color: 'red',
    });
  });

  it('drops !important flags and empty values', () => {
    expect(parseDeclarations('margin:0 !important;padding:')).toEqual({ margin: '0' });
  });
});

describe('toReactStyle', () => {
  it('camelCases properties and keeps custom properties as they are', () => {
    expect(toReactStyle({ 'min-height': '1px', '--x': 'y', '-webkit-transform': 'none' })).toEqual({
      minHeight: '1px',
      '--x': 'y',
      WebkitTransform: 'none',
    });
  });
});

describe('parsePageBuilderStyles', () => {
  it('maps every data-pb-style selector (also comma-separated) to its declarations', () => {
    const styles = parsePageBuilderStyles([
      '#html-body [data-pb-style=A1],#html-body [data-pb-style=B2]{display:flex;margin:0}' +
        '#html-body [data-pb-style=A1]{min-height:48px}',
    ]);
    expect(styles.base.get('A1')).toEqual({ display: 'flex', margin: '0', 'min-height': '48px' });
    expect(styles.base.get('B2')).toEqual({ display: 'flex', margin: '0' });
  });

  it('collects media rules separately, per element and media query', () => {
    const styles = parsePageBuilderStyles([
      '@media only screen and (max-width: 768px) { #html-body [data-pb-style=A1]{min-height:200px} }',
    ]);
    expect(styles.base.size).toBe(0);
    expect(styles.media.get('A1')).toEqual([
      { media: 'only screen and (max-width: 768px)', declarations: { 'min-height': '200px' } },
    ]);
  });

  it('accepts quoted ids and ignores selectors that are not plain data-pb-style targets', () => {
    const styles = parsePageBuilderStyles([
      '#html-body [data-pb-style="Q1"]{color:red} .foo{color:blue} #html-body [data-pb-style=Z] p{color:green}',
    ]);
    expect([...styles.base.keys()]).toEqual(['Q1']);
  });

  it('never throws on malformed css', () => {
    expect(() =>
      parsePageBuilderStyles(['#html-body [data-pb-style=A{', '}}}@media{', '']),
    ).not.toThrow();
  });
});
