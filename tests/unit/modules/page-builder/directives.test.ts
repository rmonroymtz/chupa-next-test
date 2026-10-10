import { describe, expect, it } from 'vitest';
import {
  hasDirectives,
  hasMediaDirective,
  resolveDirectives,
} from '@/modules/page-builder/parser/directives';

const MEDIA = 'https://chupaprecios.com.mx/media/';

describe('hasDirectives', () => {
  it('detects Magento template directives', () => {
    expect(hasDirectives('<img src="{{media url=wysiwyg/a.png}}">')).toBe(true);
    expect(hasDirectives('<p>Hola</p>')).toBe(false);
  });
});

describe('resolveDirectives', () => {
  it('resolves {{media url=...}} in every quoting style against the media base url', () => {
    const html =
      '<img src="{{media url=wysiwyg/a.png}}">' +
      '<img src="{{media url="wysiwyg/b.png"}}">' +
      '<img src="{{media url=\'wysiwyg/c.png\'}}">' +
      '<img src="{{media url=&quot;wysiwyg/d.png&quot;}}">' +
      '<div data-background-images="{\\&quot;desktop_image\\&quot;:\\&quot;{{media url=wysiwyg/e.png}}\\&quot;}"></div>';
    const result = resolveDirectives(html, { mediaBaseUrl: MEDIA });
    expect(result.html).toBe(
      `<img src="${MEDIA}wysiwyg/a.png">` +
        `<img src="${MEDIA}wysiwyg/b.png">` +
        `<img src="${MEDIA}wysiwyg/c.png">` +
        `<img src="${MEDIA}wysiwyg/d.png">` +
        `<div data-background-images="{\\&quot;desktop_image\\&quot;:\\&quot;${MEDIA}wysiwyg/e.png\\&quot;}"></div>`,
    );
    expect(result.stripped).toEqual([]);
  });

  it('joins base and path with exactly one slash', () => {
    expect(
      resolveDirectives('{{media url=/wysiwyg/a.png}}', { mediaBaseUrl: 'https://x.test/media' })
        .html,
    ).toBe('https://x.test/media/wysiwyg/a.png');
  });

  it('strips every other directive and reports its name', () => {
    const result = resolveDirectives(
      '<p>a{{widget type="Magento\\CatalogWidget\\Block\\Product\\ProductsList" ids="1"}}b{{store url="x"}}c</p>',
      { mediaBaseUrl: MEDIA },
    );
    expect(result.html).toBe('<p>abc</p>');
    expect(result.stripped).toEqual(['widget', 'store']);
  });

  it('strips media directives when no media base url is known', () => {
    const result = resolveDirectives('<img src="{{media url=wysiwyg/a.png}}">', {
      mediaBaseUrl: null,
    });
    expect(result.html).toBe('<img src="">');
    expect(result.stripped).toEqual(['media']);
  });

  it('leaves content without directives untouched', () => {
    const html = '<p>Precio {final}</p>';
    expect(resolveDirectives(html, { mediaBaseUrl: MEDIA })).toEqual({ html, stripped: [] });
  });
});

describe('hasMediaDirective', () => {
  it('is true only when a {{media}} directive is present', () => {
    expect(hasMediaDirective('<img src="{{media url=wysiwyg/a.png}}">')).toBe(true);
    expect(hasMediaDirective('<img src="{{ media url="a.png"}}">')).toBe(true);
    expect(hasMediaDirective('{{widget type="x"}}')).toBe(false);
    expect(hasMediaDirective('{{mediaurl}}')).toBe(false);
    expect(hasMediaDirective('<p>media</p>')).toBe(false);
  });
});
