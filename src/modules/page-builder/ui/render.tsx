import { getImageProps } from 'next/image';
import Image from 'next/image';
import { preload } from 'react-dom';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { PageBuilderView } from '@/modules/page-builder/application/page-builder-loader';
import type {
  BannerNode,
  Box,
  ButtonType,
  ContentNode,
  ImageNode,
  ImageSource,
  Link,
  MapNode,
  ProductsNode,
  RowNode,
  TabsNode,
  VideoNode,
} from '@/modules/page-builder/domain/content-node';
import { toEmbedUrl } from '@/modules/page-builder/domain/video-source';
import { MagentoProductPrice } from '@/modules/product/ui/magento-product-price';
import { isOptimizableImageUrl, parseImageRemoteHosts } from '@/shared/config/image-hosts';
import { backgroundPreloadUrl, backgroundStyle } from './background';
import styles from './page-builder.module.css';
import { Slider } from './slider.client';
import { Tabs } from './tabs.client';

const REMOTE_PATTERNS = parseImageRemoteHosts(process.env.IMAGE_REMOTE_HOSTS);
// Content is at most --pb-max-width (1280px) wide.
const IMAGE_SIZES = '(min-width: 1280px) 1280px, 100vw';
const PRODUCT_IMAGE_SIZES = '(min-width: 961px) 20vw, (min-width: 641px) 25vw, 50vw';
const STYLE_ID = /^[A-Za-z0-9_-]+$/;

export interface RenderLogger {
  error(context: Record<string, unknown>, message: string): void;
}

interface RenderContext {
  readonly view: PageBuilderView;
  readonly source: string;
  readonly logger: RenderLogger;
  /** Responsive admin rules of rendered elements, emitted once in a scoped <style>. */
  readonly mediaRules: Map<string, Box['mediaStyles']>;
  /** True until the LCP candidate of the first top-level node is claimed. */
  lcpAvailable: boolean;
}

/**
 * Renders parsed Page Builder content as Server Components (only the slider
 * and tabs hydrate). Every top-level node renders in isolation: a node that
 * fails is logged and left out, the rest of the page still renders.
 */
export function renderPageBuilder(
  view: PageBuilderView,
  options: { readonly source: string; readonly logger: RenderLogger },
): ReactNode {
  const context: RenderContext = {
    view,
    ...options,
    mediaRules: new Map(),
    lcpAvailable: false,
  };
  const nodes = view.document.nodes.map((node, index) => {
    // Best effort: the hero (first row) image or background is the likely LCP element.
    context.lcpAvailable = index === 0;
    return <Fragment key={index}>{renderSafely(node, context)}</Fragment>;
  });
  context.lcpAvailable = false;
  const css = mediaCss(context.mediaRules);
  return (
    <div className={styles.root} data-page-builder="">
      {css ? <style>{css}</style> : null}
      {nodes}
    </div>
  );
}

function renderSafely(node: ContentNode, context: RenderContext): ReactNode {
  try {
    return renderNode(node, context);
  } catch (error) {
    context.logger.error(
      { source: context.source, contentType: node.type, err: error },
      'page builder node failed to render',
    );
    return null;
  }
}

function renderNodes(nodes: readonly ContentNode[], context: RenderContext): ReactNode[] {
  return nodes.map((node, index) => <Fragment key={index}>{renderNode(node, context)}</Fragment>);
}

function renderNode(node: ContentNode, context: RenderContext): ReactNode {
  if (node.box.hidden) return null;
  switch (node.type) {
    case 'row':
      return renderRow(node, context);
    case 'column-group':
    case 'column-line':
      return (
        <div
          {...boxProps(
            node.box,
            context,
            node.type === 'column-group' ? styles.columnGroup : styles.columnLine,
          )}
        >
          {renderNodes(node.children, context)}
        </div>
      );
    case 'column': {
      const background = backgroundStyle(node.background);
      claimBackground(context, background, backgroundPreloadUrl(node.background));
      return (
        <div
          {...boxProps(node.box, context, cx(styles.column, background && styles.bg), background)}
        >
          {renderNodes(node.children, context)}
        </div>
      );
    }
    case 'text':
      return (
        <div
          {...boxProps(node.box, context, cx(styles.text, styles.rich))}
          dangerouslySetInnerHTML={{ __html: node.html }}
        />
      );
    case 'heading': {
      const Tag = `h${node.level}` as const;
      return <Tag {...boxProps(node.box, context, styles.heading)}>{node.text}</Tag>;
    }
    case 'image':
      return renderImage(node, context);
    case 'banner':
    case 'slide':
      return renderBanner(node, context);
    case 'buttons':
      return (
        <div
          {...boxProps(
            node.box,
            context,
            cx(
              styles.buttons,
              node.appearance === 'stacked' ? styles.buttonsStacked : styles.buttonsInline,
              node.sameWidth && styles.buttonsSameWidth,
            ),
          )}
        >
          {renderNodes(node.children, context)}
        </div>
      );
    case 'button-item':
      return (
        <div {...boxProps(node.box, context)}>
          <LinkOrSpan
            link={node.link}
            className={buttonClass(node.buttonType)}
            style={node.buttonStyle}
          >
            {node.text}
          </LinkOrSpan>
        </div>
      );
    case 'divider':
      return (
        <div {...boxProps(node.box, context)}>
          <hr className={styles.hr} style={node.lineStyle} />
        </div>
      );
    case 'html':
    case 'fragment':
      return (
        <div
          {...boxProps(
            node.box,
            context,
            node.type === 'fragment' ? cx(styles.html, styles.rich) : styles.html,
          )}
          dangerouslySetInnerHTML={{ __html: node.html }}
        />
      );
    case 'video':
      return renderVideo(node, context);
    case 'map':
      return renderMap(node, context);
    case 'block':
    case 'dynamic_block': {
      const content =
        node.children.length > 0 ? (
          renderNodes(node.children, context)
        ) : node.html ? (
          <div className={styles.rich} dangerouslySetInnerHTML={{ __html: node.html }} />
        ) : null;
      return content ? <div {...boxProps(node.box, context)}>{content}</div> : null;
    }
    case 'tabs':
      return renderTabs(node, context);
    case 'tab-item':
      // Only meaningful inside tabs; render the content if it shows up alone.
      return <div {...boxProps(node.box, context)}>{renderNodes(node.children, context)}</div>;
    case 'slider': {
      const slides = node.children;
      const box = boxProps(node.box, context);
      return (
        <Slider
          slides={renderNodes(slides, context)}
          slideNames={slides.map((slide) => (slide.type === 'slide' ? slide.name : null))}
          autoplay={node.autoplay}
          autoplaySpeed={node.autoplaySpeed}
          fade={node.fade}
          infinite={node.infinite}
          showArrows={node.showArrows}
          showDots={node.showDots}
          className={box.className ?? ''}
          style={box.style ?? {}}
          styleId={box['data-pb-style']}
        />
      );
    }
    case 'products':
      return renderProducts(node, context);
    case 'unknown':
      return node.children.length > 0 ? <>{renderNodes(node.children, context)}</> : null;
  }
}

function renderRow(node: RowNode, context: RenderContext): ReactNode {
  const background = backgroundStyle(node.background, node.videoFallbackSrc);
  claimBackground(
    context,
    background,
    backgroundPreloadUrl(node.background, node.videoFallbackSrc),
  );
  const children = renderNodes(node.children, context);
  const inner = boxProps(node.box, context, cx(styles.row, background && styles.bg), background);
  switch (node.appearance) {
    case 'contained':
      return (
        <div className={styles.contained}>
          <div {...inner}>{children}</div>
        </div>
      );
    case 'full-width':
      return (
        <div {...inner} className={cx(inner.className, styles.fullWidth)}>
          <div className={styles.contained}>{children}</div>
        </div>
      );
    case 'full-bleed':
      // The CMS page is full width, so a full-bleed row needs no 100vw tricks.
      return (
        <div {...inner} className={cx(inner.className, styles.fullWidth)}>
          {children}
        </div>
      );
  }
}

function renderImage(node: ImageNode, context: RenderContext): ReactNode {
  const primary = node.desktop ?? node.mobile;
  if (!primary) return null;
  const eager = claimLcp(context);
  const imgStyle = node.imageStyle as CSSProperties;
  const main = imageAttributes(primary, node.alt, eager);
  let picture: ReactNode;
  if (node.desktop && node.mobile) {
    const mobile = imageAttributes(node.mobile, node.alt, eager);
    picture = (
      <picture>
        <source
          media="(max-width: 768px)"
          srcSet={mobile.srcSet ?? mobile.src}
          sizes={mobile.sizes}
          width={mobile.width}
          height={mobile.height}
        />
        <img
          {...main}
          alt={main.alt}
          title={node.title ?? undefined}
          className={styles.img}
          style={imgStyle}
        />
      </picture>
    );
  } else {
    picture = (
      // eslint-disable-next-line @next/next/no-img-element -- attributes come from next/image getImageProps
      <img
        {...main}
        alt={main.alt}
        title={node.title ?? undefined}
        className={styles.img}
        style={imgStyle}
      />
    );
  }
  if (eager && main.srcSet === undefined && !(node.desktop && node.mobile)) {
    preload(main.src, { as: 'image', fetchPriority: 'high' });
  }
  return (
    <figure {...boxProps(node.box, context, styles.figure)}>
      {node.link ? <LinkOrSpan link={node.link}>{picture}</LinkOrSpan> : picture}
      {node.caption ? <figcaption className={styles.caption}>{node.caption}</figcaption> : null}
    </figure>
  );
}

interface ImgAttributes {
  readonly src: string;
  readonly alt: string;
  readonly srcSet?: string | undefined;
  readonly sizes?: string | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly loading: 'eager' | 'lazy';
  readonly decoding: 'async';
  readonly fetchPriority?: 'high' | undefined;
}

/**
 * Optimized through next/image when Magento stored the dimensions. Without
 * them (Magento's default master format) the original file is used at its
 * natural size, as legacy did: requesting a width would upscale small images.
 */
function imageAttributes(source: ImageSource, alt: string, eager: boolean): ImgAttributes {
  const loading = eager ? 'eager' : 'lazy';
  const fetchPriority = eager ? ('high' as const) : undefined;
  if (source.width && source.height && isOptimizableImageUrl(source.src, REMOTE_PATTERNS)) {
    const { props } = getImageProps({
      src: source.src,
      alt,
      width: source.width,
      height: source.height,
      sizes: IMAGE_SIZES,
      loading,
      fetchPriority,
    });
    return {
      src: props.src,
      alt,
      srcSet: props.srcSet,
      sizes: props.sizes,
      width: source.width,
      height: source.height,
      loading,
      decoding: 'async',
      fetchPriority,
    };
  }
  return {
    src: source.src,
    alt,
    width: source.width ?? undefined,
    height: source.height ?? undefined,
    loading,
    decoding: 'async',
    fetchPriority,
  };
}

const OVERLAY_CLASS: Record<BannerNode['appearance'], string | undefined> = {
  poster: styles.posterOverlay,
  'collage-left': styles.collageLeftOverlay,
  'collage-centered': styles.collageCenteredOverlay,
  'collage-right': styles.collageRightOverlay,
};

function renderBanner(node: BannerNode, context: RenderContext): ReactNode {
  const background = backgroundStyle(node.background, node.videoFallbackSrc);
  claimBackground(
    context,
    background,
    backgroundPreloadUrl(node.background, node.videoFallbackSrc),
  );
  const poster = node.appearance === 'poster';
  const styleId = registerMedia(node.box, context);
  const overlayStyle: CSSProperties = {
    ...(node.overlayStyle as CSSProperties),
    ...(node.overlay ? { backgroundColor: node.overlay.color } : {}),
  };
  const wrapper = (
    <div
      className={cx(styles.bannerWrapper, background && styles.bg)}
      style={{ ...(node.wrapperStyle as CSSProperties), ...background }}
      data-pb-style={poster ? undefined : styleId}
    >
      <div
        className={cx(
          styles.overlay,
          OVERLAY_CLASS[node.appearance],
          node.overlay?.show === 'hover' && styles.overlayOnHover,
        )}
        style={overlayStyle}
        data-pb-style={poster ? styleId : undefined}
      >
        <div
          className={cx(styles.bannerContent, styles.rich)}
          dangerouslySetInnerHTML={{ __html: node.contentHtml }}
        />
        {node.button ? (
          // Presentational: the whole banner is the link (no nested interactive elements).
          <div
            className={cx(
              styles.bannerButton,
              node.button.show === 'hover' && styles.buttonOnHover,
            )}
          >
            <span className={buttonClass(node.button.type)}>{node.button.text}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
  return (
    <div className={cx(styles.banner, ...node.box.classes)} style={node.box.style as CSSProperties}>
      {node.link ? (
        <LinkOrSpan link={node.link} className={styles.bannerLink}>
          {wrapper}
        </LinkOrSpan>
      ) : (
        wrapper
      )}
    </div>
  );
}

function renderVideo(node: VideoNode, context: RenderContext): ReactNode {
  const { source } = node;
  if (!source) return null;
  const player =
    source.kind === 'file' ? (
      <video
        className={styles.video}
        src={source.url}
        controls
        preload="metadata"
        playsInline
        autoPlay={node.autoplay}
        muted={node.muted || node.autoplay}
      />
    ) : (
      <iframe
        className={styles.video}
        src={toEmbedUrl(source, { autoplay: node.autoplay, muted: node.muted })}
        title={source.kind === 'youtube' ? 'Video de YouTube' : 'Video de Vimeo'}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  return (
    <div {...boxProps(node.box, context)}>
      <div
        className={styles.videoInner}
        style={node.maxWidth ? { maxWidth: node.maxWidth } : undefined}
      >
        <div className={styles.videoWrapper} style={node.wrapperStyle as CSSProperties}>
          <div className={styles.videoContainer}>{player}</div>
        </div>
      </div>
    </div>
  );
}

/** Static fallback: there is no Google Maps API key, so locations link to Google Maps. */
function renderMap(node: MapNode, context: RenderContext): ReactNode {
  if (node.locations.length === 0) return null;
  return (
    <div
      {...boxProps(node.box, context, styles.map, node.height ? { minHeight: node.height } : null)}
    >
      {node.locations.map((location, index) => (
        <div key={index} className={styles.mapLocation}>
          {location.name ? <h3>{location.name}</h3> : null}
          {location.address ? <p>{location.address}</p> : null}
          {location.phone ? (
            <p>
              <a href={`tel:${location.phone.replace(/[^\d+]/g, '')}`}>{location.phone}</a>
            </p>
          ) : null}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver en Google Maps
            <span className={styles.srOnly}> (se abre en una pestaña nueva)</span>
          </a>
        </div>
      ))}
    </div>
  );
}

function renderTabs(node: TabsNode, context: RenderContext): ReactNode {
  const items = node.children.filter((child) => child.type === 'tab-item');
  const panels = items.map((item, index) => {
    const background = item.type === 'tab-item' ? backgroundStyle(item.background) : null;
    return (
      <div
        key={index}
        {...boxProps(item.box, context, background ? styles.bg : undefined, background)}
      >
        {renderNodes(item.children, context)}
      </div>
    );
  });
  const box = boxProps(node.box, context);
  return (
    <Tabs
      headers={items.map(
        (item, index) => node.headers[index] || (item.type === 'tab-item' ? item.name : ''),
      )}
      panels={panels}
      defaultIndex={node.defaultIndex}
      alignment={node.navigationAlignment}
      className={box.className ?? ''}
      style={box.style ?? {}}
      contentStyle={node.contentStyle as CSSProperties}
      styleId={box['data-pb-style']}
    />
  );
}

function renderProducts(node: ProductsNode, context: RenderContext): ReactNode {
  const cards = context.view.productsFor(node);
  // Legacy hides the content type when Magento finds none of its products.
  if (cards.length === 0) return null;
  const list = (
    <ul className={node.appearance === 'carousel' ? styles.productCarousel : styles.productGrid}>
      {cards.map((card) => (
        <li key={card.uid}>
          {/* Plain anchor: next/link would prefetch product pages (and their side effects). */}
          <a href={`/${card.relativeUrl}`} className={styles.productCard}>
            <div className={styles.productImage}>
              {card.image ? (
                <Image
                  src={card.image.url}
                  alt={card.image.label ?? card.name}
                  fill
                  sizes={PRODUCT_IMAGE_SIZES}
                  style={{ objectFit: 'contain' }}
                  unoptimized={!isOptimizableImageUrl(card.image.url, REMOTE_PATTERNS)}
                />
              ) : null}
            </div>
            <span className={styles.productName}>{card.name}</span>
            <MagentoProductPrice product={card} size="sm" />
          </a>
        </li>
      ))}
    </ul>
  );
  return (
    <div {...boxProps(node.box, context)}>
      {node.appearance === 'carousel' ? (
        // Keyboard-scrollable region (scroll snap, no carousel JavaScript).
        <div role="region" aria-label="Productos" tabIndex={0}>
          {list}
        </div>
      ) : (
        list
      )}
    </div>
  );
}

// --- Helpers -------------------------------------------------------------------

function LinkOrSpan({
  link,
  className,
  style,
  children,
}: {
  readonly link: Link | null;
  readonly className?: string | undefined;
  readonly style?: object | undefined;
  readonly children: ReactNode;
}) {
  if (!link) {
    return (
      <span className={className} style={style as CSSProperties}>
        {children}
      </span>
    );
  }
  return (
    <a
      href={link.href}
      className={className}
      style={style as CSSProperties}
      {...(link.openInNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}

function buttonClass(type: ButtonType): string {
  return cx(
    styles.button,
    type === 'secondary'
      ? styles.buttonSecondary
      : type === 'link'
        ? styles.buttonLink
        : styles.buttonPrimary,
  );
}

function boxProps(
  box: Box,
  context: RenderContext,
  className?: string | false | null,
  extraStyle?: CSSProperties | null,
): { className?: string; style?: CSSProperties; 'data-pb-style'?: string } {
  const classes = cx(className, ...box.classes);
  const style = { ...(box.style as CSSProperties), ...extraStyle };
  const styleId = registerMedia(box, context);
  return {
    ...(classes ? { className: classes } : {}),
    ...(Object.keys(style).length > 0 ? { style } : {}),
    ...(styleId ? { 'data-pb-style': styleId } : {}),
  };
}

/** Keeps the element's responsive rules; returns the id to set on it. */
function registerMedia(box: Box, context: RenderContext): string | undefined {
  if (!box.styleId || box.mediaStyles.length === 0 || !STYLE_ID.test(box.styleId)) {
    return undefined;
  }
  context.mediaRules.set(box.styleId, box.mediaStyles);
  return box.styleId;
}

/** Admin responsive rules; `!important` because base styles are inline. */
function mediaCss(rules: ReadonlyMap<string, Box['mediaStyles']>): string {
  const css: string[] = [];
  for (const [id, mediaStyles] of rules) {
    for (const { media, declarations } of mediaStyles) {
      const body = Object.entries(declarations)
        .map(([property, value]) => `${safeCss(property)}:${safeCss(value)} !important`)
        .join(';');
      if (body) {
        css.push(`@media ${safeCss(media)}{[data-page-builder] [data-pb-style="${id}"]{${body}}}`);
      }
    }
  }
  return css.join('');
}

/** Admin CSS is trusted, but must never close the <style> element or a block. */
function safeCss(value: string): string {
  return value.replace(/[<>{}]/g, '');
}

function claimLcp(context: RenderContext): boolean {
  if (!context.lcpAvailable) return false;
  context.lcpAvailable = false;
  return true;
}

/** A background in the first top-level node claims the LCP slot; preloaded when it has one url. */
function claimBackground(
  context: RenderContext,
  background: CSSProperties | null,
  preloadUrl: string | null,
): void {
  if (!background) return;
  if (claimLcp(context) && preloadUrl) preload(preloadUrl, { as: 'image', fetchPriority: 'high' });
}

function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
