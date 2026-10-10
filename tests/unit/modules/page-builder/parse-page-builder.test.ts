import { describe, expect, it } from 'vitest';
import blocks from '../../../fixtures/page-builder/cms-blocks.sliders.json';
import aviso from '../../../fixtures/page-builder/cms-page.aviso-privacidad.json';
import home from '../../../fixtures/page-builder/cms-page.home.json';
import type {
  BannerNode,
  ContentNode,
  ImageNode,
  RowNode,
} from '@/modules/page-builder/domain/content-node';
import { parsePageBuilder } from '@/modules/page-builder/parser/parse-page-builder';

const MEDIA = 'https://chupaprecios.com.mx/media/wysiwyg';

/** Magento stores JSON attributes with escaped quotes: `{\"desktop_image\":\"...\"}`. */
const bgImages = (desktop: string, mobile?: string) =>
  `{\\&quot;desktop_image\\&quot;:\\&quot;${desktop}\\&quot;${
    mobile ? `,\\&quot;mobile_image\\&quot;:\\&quot;${mobile}\\&quot;` : ''
  }}`;

/** The node variant(s) whose `type` admits T (some variants share a union of types). */
type NodeOf<T> = ContentNode extends infer N
  ? N extends { type: infer U }
    ? T extends U
      ? N
      : never
    : never
  : never;

function only<T extends ContentNode['type']>(html: string, type: T): NodeOf<T> {
  const doc = parsePageBuilder(html);
  const node = doc.nodes[0];
  expect(doc.nodes).toHaveLength(1);
  expect(node?.type).toBe(type);
  return node as NodeOf<T>;
}

function shape(nodes: readonly ContentNode[]): unknown[] {
  return nodes.map((node) =>
    node.children.length > 0 ? { [node.type]: shape(node.children) } : node.type,
  );
}

describe('parsePageBuilder: detection', () => {
  it('renders content without Page Builder markup as one sanitized html fragment', () => {
    const doc = parsePageBuilder(home.data.cmsPage.content);
    expect(doc.isPageBuilder).toBe(false);
    expect(doc.nodes).toEqual([
      expect.objectContaining({
        type: 'fragment',
        html: expect.stringMatching(/^<p>CMS homepage content goes here\.<\/p>\s*$/),
      }),
    ]);
  });

  it('returns no nodes for empty content', () => {
    expect(parsePageBuilder('   ').nodes).toEqual([]);
  });
});

describe('parsePageBuilder: real CMS content', () => {
  it('parses the live aviso-privacidad page (rows with text, styles from the <style> block)', () => {
    const doc = parsePageBuilder(aviso.data.route.content);
    expect(doc.isPageBuilder).toBe(true);
    expect(doc.warnings).toEqual([]);
    expect(shape(doc.nodes)).toEqual([{ row: ['text'] }, { row: ['text'] }]);

    const row = doc.nodes[0] as RowNode;
    expect(row.appearance).toBe('contained');
    expect(row.box.styleId).toBe('YEPTG0N');
    expect(row.box.style).toMatchObject({
      justifyContent: 'flex-start',
      display: 'flex',
      flexDirection: 'column',
      backgroundSize: 'cover',
    });
    const heading = row.children[0];
    expect(heading?.type === 'text' && heading.html).toContain('Aviso de privacidad');
    expect(heading?.box.classes).toEqual(['headingStaticPage']);
  });

  it('parses the live top-banner slider (autoplay, fade, poster slides)', () => {
    const block = blocks.items.find((item) => item.identifier === 'top-banner-slider');
    const row = only(block!.content, 'row');
    const slider = row.children[0];
    expect(slider?.type).toBe('slider');
    if (slider?.type !== 'slider') return;
    expect(slider).toMatchObject({
      autoplay: true,
      autoplaySpeed: 4000,
      fade: true,
      infinite: true,
      showArrows: false,
      showDots: false,
    });
    expect(slider.box.style).toMatchObject({ minHeight: '48px' });
    expect(slider.box.classes).toEqual(['pagebuilder-slider', 'top-banner-slider']);
    expect(slider.children.length).toBeGreaterThan(1);
    const slide = slider.children[0] as BannerNode;
    expect(slide.type).toBe('slide');
    expect(slide.appearance).toBe('poster');
    expect(slide.button).toBeNull();
    expect(slide.overlay).toBeNull();
    expect(slide.overlayStyle).toMatchObject({ minHeight: '48px', padding: '0' });
    expect(slide.contentHtml).toContain('Envío gratis');
  });

  it('decodes the live html content type (escaped markup) into trusted html', () => {
    const block = blocks.items.find((item) => item.identifier === 'hero-slider-container');
    const node = only(block!.content, 'html');
    expect(node.html).toContain(
      '<img src="https://chupapreciosimg.s3.us-east-2.amazonaws.com/desktop-slide.png"',
    );
    expect(node.html).toContain(
      'href="https://pbs.twimg.com/media/FziBn0BWwAEa4qx?format=jpg&amp;name=small"',
    );
  });
});

describe('parsePageBuilder: layout', () => {
  it('row appearances, background images, parallax and media rules', () => {
    const html =
      '<style>#html-body [data-pb-style=R1]{min-height:400px;background-color:#eee;background-attachment:fixed}' +
      '@media only screen and (max-width: 768px){#html-body [data-pb-style=R1]{min-height:200px}}</style>' +
      `<div data-content-type="row" data-appearance="full-bleed" data-enable-parallax="1" data-parallax-speed="0.5" data-background-images="${bgImages(`${MEDIA}/hero.jpg`, `${MEDIA}/hero-m.jpg`)}" data-background-type="image" data-element="main" data-pb-style="R1"></div>`;
    const row = only(html, 'row');
    expect(row.appearance).toBe('full-bleed');
    expect(row.background).toEqual({ desktop: `${MEDIA}/hero.jpg`, mobile: `${MEDIA}/hero-m.jpg` });
    // Parallax degrades to a static background: the admin attachment is kept as is.
    expect(row.box.style).toEqual({
      minHeight: '400px',
      backgroundColor: '#eee',
      backgroundAttachment: 'fixed',
    });
    expect(row.box.mediaStyles).toEqual([
      { media: 'only screen and (max-width: 768px)', declarations: { 'min-height': '200px' } },
    ]);
  });

  it('contained rows read their styles from the inner element; video backgrounds keep the fallback image', () => {
    const html =
      '<div data-content-type="row" data-appearance="contained" data-element="main">' +
      `<div data-background-type="video" data-video-src="https://youtu.be/x" data-video-fallback-src="${MEDIA}/fallback.jpg" data-background-images="{}" data-element="inner" style="padding: 10px; display: none;"></div></div>`;
    const row = only(html, 'row');
    expect(row.box.style).toEqual({ padding: '10px', display: 'none' });
    expect(row.box.hidden).toBe(true);
    expect(row.videoFallbackSrc).toBe(`${MEDIA}/fallback.jpg`);
  });

  it('nests column groups, lines and columns with their widths', () => {
    const html =
      '<style>#html-body [data-pb-style=C1]{width:33.3333%;align-self:stretch}#html-body [data-pb-style=C2]{width:66.6667%}</style>' +
      '<div data-content-type="row" data-appearance="contained" data-element="main"><div data-element="inner">' +
      '<div class="pagebuilder-column-group" data-content-type="column-group" data-grid-size="12" data-element="main" style="display: flex;">' +
      '<div class="pagebuilder-column-line" data-content-type="column-line" data-element="main" style="display: flex;">' +
      '<div class="pagebuilder-column" data-content-type="column" data-appearance="full-height" data-background-images="{}" data-element="main" data-pb-style="C1"><h2 data-content-type="heading" data-appearance="default" data-element="main">Uno</h2></div>' +
      '<div class="pagebuilder-column" data-content-type="column" data-appearance="full-height" data-background-images="{}" data-element="main" data-pb-style="C2"></div>' +
      '</div></div></div></div>';
    const doc = parsePageBuilder(html);
    expect(shape(doc.nodes)).toEqual([
      { row: [{ 'column-group': [{ 'column-line': [{ column: ['heading'] }, 'column'] }] }] },
    ]);
    const line = doc.nodes[0]!.children[0]!.children[0]!;
    expect(line.children.map((column) => column.box.style.width)).toEqual(['33.3333%', '66.6667%']);
  });

  it('tabs with headers, active tab and tab items', () => {
    const html =
      '<div class="tab-align-center" data-content-type="tabs" data-appearance="default" data-active-tab="1" data-element="main">' +
      '<ul role="tablist" class="tabs-navigation" data-element="navigation">' +
      '<li role="tab" class="tab-header" data-element="headers"><a href="#A" class="tab-title"><span class="tab-title">Uno</span></a></li>' +
      '<li role="tab" class="tab-header" data-element="headers"><a href="#B" class="tab-title"><span class="tab-title">Dos</span></a></li></ul>' +
      '<div class="tabs-content" data-element="content" style="min-height: 250px;">' +
      '<div data-content-type="tab-item" data-appearance="default" data-tab-name="Uno" data-background-images="{}" data-element="main" id="A"><div data-content-type="text" data-appearance="default" data-element="main"><p>1</p></div></div>' +
      '<div data-content-type="tab-item" data-appearance="default" data-tab-name="Dos" data-background-images="{}" data-element="main" id="B"></div>' +
      '</div></div>';
    const tabs = only(html, 'tabs');
    expect(tabs).toMatchObject({
      defaultIndex: 1,
      navigationAlignment: 'center',
      headers: ['Uno', 'Dos'],
      contentStyle: { minHeight: '250px' },
    });
    expect(shape(tabs.children)).toEqual([{ 'tab-item': ['text'] }, 'tab-item']);
    expect(tabs.children[1]).toMatchObject({ type: 'tab-item', name: 'Dos' });
  });
});

describe('parsePageBuilder: elements', () => {
  it('text keeps its inner html and advanced styles', () => {
    const node = only(
      '<div data-content-type="text" data-appearance="default" data-element="main" style="text-align: right; margin: 0 0 10px;"><p>Hola <strong>mundo</strong></p></div>',
      'text',
    );
    expect(node.html).toBe('<p>Hola <strong>mundo</strong></p>');
    expect(node.box.style).toEqual({ textAlign: 'right', margin: '0 0 10px' });
  });

  it('heading level and text', () => {
    const node = only(
      '<h3 data-content-type="heading" data-appearance="default" data-element="main">Envíos <em>gratis</em></h3>',
      'heading',
    );
    expect(node).toMatchObject({ level: 3, text: 'Envíos gratis' });
  });

  it('image with desktop/mobile sources, link, caption and dimensions', () => {
    const html =
      '<figure data-content-type="image" data-appearance="full-width" data-element="main" style="text-align: center;">' +
      '<a href="/ofertas" target="_blank" data-link-type="default" data-element="link">' +
      `<img class="pagebuilder-mobile-hidden" src="${MEDIA}/d.jpg" alt="Ofertas" title="T" data-element="desktop_image" data-image-dimensions='{"width":1200,"height":400}' style="border-style: solid; border-width: 1px;">` +
      `<img class="pagebuilder-mobile-only" src="${MEDIA}/m.jpg" alt="Ofertas" title="T" data-element="mobile_image"></a>` +
      '<figcaption data-element="caption">Temporada</figcaption></figure>';
    const node = only(html, 'image') as ImageNode;
    expect(node).toMatchObject({
      desktop: { src: `${MEDIA}/d.jpg`, width: 1200, height: 400 },
      mobile: { src: `${MEDIA}/m.jpg`, width: null, height: null },
      alt: 'Ofertas',
      title: 'T',
      link: { href: '/ofertas', openInNewTab: true },
      caption: 'Temporada',
      imageStyle: { borderStyle: 'solid', borderWidth: '1px' },
    });
    expect(node.box.style).toEqual({ textAlign: 'center' });
  });

  it('image: the same mobile source is dropped; a lone mobile image is kept', () => {
    const same = only(
      `<figure data-content-type="image" data-element="main"><img src="${MEDIA}/a.jpg" alt="" data-element="desktop_image"><img src="${MEDIA}/a.jpg" alt="" data-element="mobile_image"></figure>`,
      'image',
    );
    expect(same.mobile).toBeNull();
    const mobileOnly = only(
      `<figure data-content-type="image" data-element="main"><img src="${MEDIA}/m.jpg" alt="" data-element="mobile_image"></figure>`,
      'image',
    );
    expect(mobileOnly).toMatchObject({
      desktop: null,
      mobile: { src: `${MEDIA}/m.jpg` },
      link: null,
    });
  });

  it('banner (collage) with link, button, overlay and background', () => {
    const html =
      '<style>#html-body [data-pb-style=BW]{background-color:#000;min-height:300px;padding:40px;border-radius:4px}' +
      '#html-body [data-pb-style=BO]{border-radius:4px}</style>' +
      '<div class="promo" data-content-type="banner" data-appearance="collage-left" data-show-button="hover" data-show-overlay="always" data-element="main" style="margin: 0 0 20px;">' +
      '<a href="https://chupaprecios.com.mx/ofertas" target="_blank" data-link-type="default" data-element="link">' +
      `<div class="pagebuilder-banner-wrapper" data-background-images="${bgImages(`${MEDIA}/b.jpg`)}" data-background-type="image" data-element="wrapper" data-pb-style="BW">` +
      '<div class="pagebuilder-overlay" data-overlay-color="rgba(0,0,0,0.4)" data-element="overlay" data-pb-style="BO">' +
      '<div class="pagebuilder-collage-content"><div data-element="content"><p>Hola</p></div>' +
      '<button type="button" class="pagebuilder-banner-button pagebuilder-button-secondary" data-element="button">Comprar</button>' +
      '</div></div></div></a></div>';
    const banner = only(html, 'banner');
    expect(banner).toMatchObject({
      appearance: 'collage-left',
      contentHtml: '<p>Hola</p>',
      link: { href: 'https://chupaprecios.com.mx/ofertas', openInNewTab: true },
      button: { text: 'Comprar', type: 'secondary', show: 'hover' },
      overlay: { color: 'rgba(0,0,0,0.4)', show: 'always' },
      background: { desktop: `${MEDIA}/b.jpg`, mobile: null },
      wrapperStyle: {
        backgroundColor: '#000',
        minHeight: '300px',
        padding: '40px',
        borderRadius: '4px',
      },
    });
    expect(banner.box.style).toEqual({ margin: '0 0 20px' });
    expect(banner.box.classes).toEqual(['promo']);
    expect(banner.box.styleId).toBe('BW');
  });

  it('buttons and button items', () => {
    const html =
      '<div data-content-type="buttons" data-appearance="stacked" data-same-width="true" data-element="main" style="text-align: center;">' +
      '<div data-content-type="button-item" data-appearance="default" data-element="main"><a class="pagebuilder-button-primary" href="/ofertas" target="" data-link-type="default" data-element="link" style="text-align: center;"><span data-element="link_text">Ver ofertas</span></a></div>' +
      '<div data-content-type="button-item" data-appearance="default" data-element="main"><button class="pagebuilder-button-link" data-element="empty_link"><span data-element="link_text">Sin enlace</span></button></div>' +
      '</div>';
    const buttons = only(html, 'buttons');
    expect(buttons).toMatchObject({ appearance: 'stacked', sameWidth: true });
    expect(buttons.children).toEqual([
      expect.objectContaining({
        type: 'button-item',
        text: 'Ver ofertas',
        buttonType: 'primary',
        link: { href: '/ofertas', openInNewTab: false },
        buttonStyle: { textAlign: 'center' },
      }),
      expect.objectContaining({
        type: 'button-item',
        text: 'Sin enlace',
        buttonType: 'link',
        link: null,
      }),
    ]);
  });

  it('divider line style', () => {
    const node = only(
      '<div data-content-type="divider" data-appearance="default" data-element="main"><hr data-element="line" style="width: 50%; border-width: 2px; border-color: #ff9900; display: inline-block;"></div>',
      'divider',
    );
    expect(node.lineStyle).toEqual({ width: '50%', borderWidth: '2px', borderColor: '#ff9900' });
  });

  it('html content type: decodes escaped markup and drops scripts', () => {
    const node = only(
      '<div data-content-type="html" data-appearance="default" data-element="main">&lt;p onclick="x()"&gt;Hola&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;</div>',
      'html',
    );
    expect(node.html).toBe('<p>Hola</p>');
  });

  it('video: youtube iframe, html5 file with autoplay, max width', () => {
    const yt = only(
      '<div data-content-type="video" data-appearance="default" data-element="main"><div class="pagebuilder-video-inner" data-element="inner" style="max-width: 800px;"><div class="pagebuilder-video-wrapper" data-element="wrapper" style="border-radius: 5px;"><div class="pagebuilder-video-container"><iframe frameborder="0" allowfullscreen="" src="https://www.youtube.com/embed/dQw4w9WgXcQ" data-element="video"></iframe></div></div></div></div>',
      'video',
    );
    expect(yt).toMatchObject({
      source: { kind: 'youtube', id: 'dQw4w9WgXcQ' },
      maxWidth: '800px',
      autoplay: false,
      wrapperStyle: { borderRadius: '5px' },
    });
    const file = only(
      `<div data-content-type="video" data-appearance="default" data-element="main"><div data-element="inner"><div data-element="wrapper"><div class="pagebuilder-video-container"><video frameborder="0" controls="" autoplay="true" muted="true" src="${MEDIA}/v.mp4" data-element="video"></video></div></div></div></div>`,
      'video',
    );
    expect(file).toMatchObject({
      source: { kind: 'file', url: `${MEDIA}/v.mp4` },
      autoplay: true,
      muted: true,
    });
  });

  it('map locations and height', () => {
    const locations =
      '[{\\&quot;position\\&quot;:{\\&quot;latitude\\&quot;:32.5,\\&quot;longitude\\&quot;:-117.01},\\&quot;location_name\\&quot;:\\&quot;Tienda\\&quot;,\\&quot;address\\&quot;:\\&quot;Calle 1\\&quot;,\\&quot;city\\&quot;:\\&quot;Tijuana\\&quot;,\\&quot;state\\&quot;:\\&quot;BC\\&quot;,\\&quot;zipcode\\&quot;:\\&quot;22457\\&quot;,\\&quot;country\\&quot;:[\\&quot;México\\&quot;],\\&quot;phone\\&quot;:\\&quot;\\&quot;}]';
    const node = only(
      `<div data-content-type="map" data-appearance="default" data-show-controls="true" data-locations="${locations}" data-element="main" style="height: 400px;"></div>`,
      'map',
    );
    expect(node.height).toBe('400px');
    expect(node.locations).toEqual([
      {
        name: 'Tienda',
        latitude: 32.5,
        longitude: -117.01,
        address: 'Calle 1, Tijuana, BC, 22457, México',
        phone: null,
      },
    ]);
  });

  it('static block: nested Page Builder content becomes children', () => {
    const html =
      '<div data-content-type="block" data-appearance="default" data-element="main"><div class="widget block block-static-block">' +
      '<div data-content-type="text" data-appearance="default" data-element="main"><p>Bloque</p></div></div></div>';
    const block = only(html, 'block');
    expect(shape(block.children)).toEqual(['text']);
  });

  it('dynamic block without rendered content parses with no children', () => {
    const node = only(
      '<div data-content-type="dynamic_block" data-appearance="default" data-element="main"><div class="widget block block-banners" data-uids="MQ==" data-display-mode="fixed"><ul class="banner-items" type="widget"></ul></div></div>',
      'dynamic_block',
    );
    expect(node.children).toEqual([]);
  });

  it('products: collects product links in admin order', () => {
    const item = (href: string) =>
      `<li class="product-item"><div class="product-item-info"><a href="${href}" class="product-item-photo">foto</a><div class="product-item-details"><strong class="product-item-name"><a title="x" href="${href}" class="product-item-link">x</a></strong></div></div></li>`;
    const html =
      '<div data-content-type="products" data-appearance="carousel" data-autoplay="false" data-element="main"><div class="block widget block-products-list grid"><div class="block-content"><ol class="product-items widget-product-grid">' +
      item('https://chupaprecios.com.mx/amazon-B1-a.html') +
      item('https://chupaprecios.com.mx/ebay-2-b.html') +
      '</ol></div></div></div>';
    const node = only(html, 'products');
    expect(node.appearance).toBe('carousel');
    expect(node.productHrefs).toEqual([
      'https://chupaprecios.com.mx/amazon-B1-a.html',
      'https://chupaprecios.com.mx/ebay-2-b.html',
    ]);
  });
});

describe('parsePageBuilder: resilience', () => {
  it('unknown content types keep their children and are reported once', () => {
    const html =
      '<div data-content-type="custom-widget" data-element="main"><div data-content-type="text" data-element="main"><p>a</p></div></div>' +
      '<div data-content-type="custom-widget" data-element="main"></div>';
    const doc = parsePageBuilder(html);
    expect(shape(doc.nodes)).toEqual([{ unknown: ['text'] }, 'unknown']);
    expect(doc.nodes[0]).toMatchObject({ contentType: 'custom-widget' });
    expect(doc.warnings).toEqual(['unsupported content type: custom-widget']);
  });

  it('a content type whose markup cannot be aggregated degrades to unknown instead of throwing', () => {
    const doc = parsePageBuilder(
      '<div data-content-type="map" data-locations="{not json" data-element="main"></div>',
    );
    expect(doc.nodes[0]).toMatchObject({ type: 'map', locations: [] });
    const broken = parsePageBuilder('<div data-content-type="banner" data-element="main"></div>');
    expect(broken.nodes[0]?.type).toBe('banner');
  });

  it('malformed html still yields a tree', () => {
    const doc = parsePageBuilder(
      '<div data-content-type="row" data-appearance="contained"><div data-element="inner"><div data-content-type="text"><p>sin cerrar<b>negrita</div>',
    );
    expect(shape(doc.nodes)).toEqual([{ row: ['text'] }]);
  });

  it('ignores elements without a content type but walks into them', () => {
    const doc = parsePageBuilder(
      '<section><div data-content-type="text" data-element="main"><p>a</p></div></section>texto suelto',
    );
    expect(shape(doc.nodes)).toEqual(['text']);
  });
});
