import { describe, expect, it } from 'vitest';
import { sanitizeTrustedHtml } from '@/modules/page-builder/parser/sanitize';

describe('sanitizeTrustedHtml', () => {
  it('keeps ordinary admin markup, inline styles and iframes', () => {
    const html =
      '<p style="text-align: center;"><strong>Envío</strong> <a href="/x">ver</a></p>' +
      '<iframe src="https://www.youtube-nocookie.com/embed/a" title="v"></iframe>';
    expect(sanitizeTrustedHtml(html)).toBe(html);
  });

  it('removes scripts, event handlers and javascript: urls (they would run on SSR, unlike legacy innerHTML)', () => {
    const html =
      '<p onclick="steal()">a</p><script>alert(1)</script>' +
      '<a href=" JavaScript:alert(1)">x</a><img src="x.png" onerror="bad()">';
    expect(sanitizeTrustedHtml(html)).toBe(
      '<p>a</p><a>x</a><img src="x.png" loading="lazy" decoding="async">',
    );
  });

  it('lazy-loads images unless the admin chose a loading mode', () => {
    expect(sanitizeTrustedHtml('<img src="a.png" loading="eager">')).toBe(
      '<img src="a.png" loading="eager">',
    );
  });

  it('opens new-tab links safely', () => {
    expect(sanitizeTrustedHtml('<a href="https://x.test" target="_blank">x</a>')).toBe(
      '<a href="https://x.test" target="_blank" rel="noopener noreferrer">x</a>',
    );
  });

  it('repairs malformed markup instead of leaking it into the page', () => {
    expect(sanitizeTrustedHtml('<p>a<b>b</p></div>c')).toBe('<p>a<b>b</b></p><b>c</b>');
  });
});
