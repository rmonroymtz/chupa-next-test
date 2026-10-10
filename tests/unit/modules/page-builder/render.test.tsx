import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import blocks from '../../../fixtures/page-builder/cms-blocks.sliders.json';
import aviso from '../../../fixtures/page-builder/cms-page.aviso-privacidad.json';
import type { PageBuilderView } from '@/modules/page-builder/application/page-builder-loader';
import type { ContentNode } from '@/modules/page-builder/domain/content-node';
import { parsePageBuilder } from '@/modules/page-builder/parser/parse-page-builder';
import { renderPageBuilder } from '@/modules/page-builder/ui/render';
import { getDisplayPrice } from '@/modules/product/domain/display-price';
import type { ProductCard } from '@/modules/product/domain/product';
import { formatPrice } from '@/modules/product/ui/format-price';

const MEDIA = 'https://chupaprecios.com.mx/media/wysiwyg';

function render(html: string, products: readonly ProductCard[] = []) {
  const logger = { error: vi.fn() };
  const view: PageBuilderView = {
    document: parsePageBuilder(html),
    productsFor: () => products,
  };
  return {
    html: renderToStaticMarkup(<>{renderPageBuilder(view, { source: 'test', logger })}</>),
    logger,
  };
}

describe('renderPageBuilder', () => {
  it('renders the live aviso-privacidad page: contained rows with inline admin styles and the text html', () => {
    const { html } = render(aviso.data.route.content);
    expect(html).toContain('data-page-builder=""');
    expect(html).toContain(
      '<h4 id="HV1H3GG"><span style="color: #343333;">Aviso de privacidad</span></h4>',
    );
    expect(html).toMatch(
      /style="justify-content:flex-start;display:flex;flex-direction:column;background-position:left top;background-size:cover;background-repeat:no-repeat;background-attachment:scroll"/,
    );
    // Admin classes are kept for the site stylesheet.
    expect(html).toMatch(/class="[^"]*headingStaticPage"/);
  });

  it('renders the live slider server-side with the first slide active and the others inert', () => {
    const block = blocks.items.find((item) => item.identifier === 'top-banner-slider')!;
    const { html } = render(block.content);
    expect(html).toContain('aria-roledescription="carrusel"');
    expect(html.match(/aria-roledescription="diapositiva"/g)).toHaveLength(4);
    expect(html.match(/data-active="true"/g)).toHaveLength(1);
    expect(html.match(/inert=""/g)).toHaveLength(3);
    expect(html).toContain('Envío gratis');
    // No arrows or dots: the admin disabled them.
    expect(html).not.toContain('Diapositiva siguiente');
  });

  it('row background images become CSS variables for the desktop and mobile variants', () => {
    const bg = `{\\&quot;desktop_image\\&quot;:\\&quot;${MEDIA}/hero.jpg\\&quot;,\\&quot;mobile_image\\&quot;:\\&quot;https://cdn.test/m.jpg\\&quot;}`;
    const { html } = render(
      `<div data-content-type="row" data-appearance="full-width" data-background-images="${bg}" data-element="main" style="min-height: 300px;"></div>`,
    );
    // Magento media goes through the image optimizer; other hosts stay as they are.
    expect(html).toContain(
      `--pb-bg-desktop:url(&quot;/_next/image?url=${encodeURIComponent(`${MEDIA}/hero.jpg`)}&amp;w=1920&amp;q=75&quot;)`,
    );
    expect(html).toContain('--pb-bg-mobile:url(&quot;https://cdn.test/m.jpg&quot;)');
    expect(html).toContain('min-height:300px');
  });

  it('images: desktop/mobile <picture>, link in a new tab, caption, first image eager', () => {
    const { html } = render(
      '<div data-content-type="row" data-appearance="contained" data-element="main"><div data-element="inner">' +
        '<figure data-content-type="image" data-element="main"><a href="/ofertas" target="_blank" data-element="link">' +
        `<img src="${MEDIA}/d.jpg" alt="Ofertas" data-element="desktop_image" data-image-dimensions='{"width":1200,"height":400}'>` +
        `<img src="${MEDIA}/m.jpg" alt="Ofertas" data-element="mobile_image" data-image-dimensions='{"width":600,"height":600}'></a>` +
        '<figcaption>Temporada</figcaption></figure>' +
        `<figure data-content-type="image" data-element="main"><img src="${MEDIA}/second.jpg" alt="" data-element="desktop_image"></figure>` +
        '</div></div>',
    );
    expect(html).toContain('<picture><source media="(max-width: 768px)"');
    expect(html).toMatch(/<img [^>]*alt="Ofertas"[^>]*loading="eager"[^>]*fetchPriority="high"/);
    expect(html).toContain('width="1200" height="400"');
    expect(html).toContain('href="/ofertas" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('<figcaption');
    // Unknown dimensions: original file, natural size, lazy.
    expect(html).toMatch(new RegExp(`<img src="${MEDIA}/second.jpg" alt="" loading="lazy"`));
  });

  it('banner with link renders one anchor and a presentational button', () => {
    const { html } = render(
      '<div data-content-type="banner" data-appearance="poster" data-show-button="always" data-show-overlay="always" data-element="main">' +
        '<a href="/ofertas" data-element="link"><div data-element="wrapper"><div data-overlay-color="rgba(0,0,0,0.5)" data-element="overlay" style="min-height: 200px;">' +
        '<div data-element="content"><p>Hola</p></div><button class="pagebuilder-button-primary" data-element="button">Comprar</button></div></div></a></div>',
    );
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).not.toContain('<button');
    expect(html).toContain('Comprar');
    expect(html).toContain('background-color:rgba(0,0,0,0.5)');
  });

  it('videos use privacy-friendly lazy embeds', () => {
    const { html } = render(
      '<div data-content-type="video" data-element="main"><div data-element="inner"><div data-element="wrapper"><iframe src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></iframe></div></div></div>',
    );
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('title="Video de YouTube"');
  });

  it('responsive admin rules are emitted once, scoped to the rendered element', () => {
    const { html } = render(
      '<style>@media only screen and (max-width: 768px){#html-body [data-pb-style=T1]{text-align:left}}</style>' +
        '<div data-content-type="text" data-element="main" data-pb-style="T1"><p>a</p></div>',
    );
    expect(html).toContain(
      '<style>@media only screen and (max-width: 768px){[data-page-builder] [data-pb-style="T1"]{text-align:left !important}}</style>',
    );
    expect(html).toContain('data-pb-style="T1"');
  });

  it('products render cards with the PDP price function', () => {
    const product: ProductCard = {
      uid: 'u1',
      sku: 'B0DISCOUNT',
      name: 'Lámpara',
      urlKey: 'amazon-B0DISCOUNT-desk-lamp',
      relativeUrl: 'amazon-B0DISCOUNT-desk-lamp.html',
      image: { url: `${MEDIA}/lamp.jpg`, label: null },
      price: {
        final: { amount: 899.5, currency: 'MXN' },
        regular: { amount: 1299, currency: 'MXN' },
        discount: null,
      },
      availability: 'in_stock',
    };
    const { html } = render(
      '<div data-content-type="products" data-appearance="carousel" data-element="main"></div>',
      [product],
    );
    const price = getDisplayPrice(product)!;
    expect(html).toContain('href="/amazon-B0DISCOUNT-desk-lamp.html"');
    expect(html).toContain(formatPrice(price.amount, price.currency));
    expect(html).toContain(formatPrice(price.previous!, price.currency));
    expect(html).toContain('role="region" aria-label="Productos" tabindex="0"');
  });

  it('products without any Magento match render nothing', () => {
    const { html } = render('<div data-content-type="products" data-element="main"></div>');
    expect(html).not.toContain('<ul');
    expect(html).not.toContain('<a ');
  });

  it('a node that fails to render is left out and logged; the rest of the page renders', () => {
    const broken = {
      type: 'text',
      box: { style: {}, styleId: null, mediaStyles: [], classes: [], hidden: false },
      children: [],
      get html(): string {
        throw new Error('boom');
      },
    } as unknown as ContentNode;
    const healthy = parsePageBuilder('<div data-content-type="text"><p>sigue</p></div>').nodes[0]!;
    const logger = { error: vi.fn() };
    const html = renderToStaticMarkup(
      <>
        {renderPageBuilder(
          {
            document: { isPageBuilder: true, nodes: [broken, healthy], warnings: [] },
            productsFor: () => [] as ProductCard[],
          },
          { source: 'cms:x', logger },
        )}
      </>,
    );
    expect(html).toContain('sigue');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'cms:x', contentType: 'text' }),
      'page builder node failed to render',
    );
  });

  it('unknown content types render their children only', () => {
    const { html } = render(
      '<div data-content-type="custom" data-element="main"><div data-content-type="text"><p>hijo</p></div></div>',
    );
    expect(html).toContain('hijo');
  });
});
