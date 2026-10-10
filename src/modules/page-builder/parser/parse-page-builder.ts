import type {
  BackgroundImages,
  BannerAppearance,
  Box,
  ButtonType,
  ContentNode,
  CssStyle,
  ImageSource,
  Link,
  MapLocation,
  PageBuilderDocument,
  ShowSetting,
} from '@/modules/page-builder/domain/content-node';
import { parseVideoSource } from '@/modules/page-builder/domain/video-source';
import {
  attr,
  byDataElement,
  childElements,
  classList,
  findAll,
  findFirst,
  hasClass,
  innerHtml,
  isElement,
  parseHtml,
  textContent,
  type Element,
  type ParentNode,
} from '@/modules/page-builder/parser/dom';
import {
  parseDeclarations,
  parsePageBuilderStyles,
  toReactStyle,
  type Declarations,
  type PageBuilderStyles,
} from '@/modules/page-builder/parser/pb-styles';
import { sanitizeTrustedHtml } from '@/modules/page-builder/parser/sanitize';

/** Same test as legacy `detectPageBuilder`. */
export function isPageBuilderContent(html: string): boolean {
  return /data-content-type=/.test(html);
}

/**
 * Parses Page Builder storage HTML into a typed tree, replicating the legacy
 * PWA Studio `parseStorageHtml` + per-type `configAggregator`s on the server.
 * Never throws: unsupported types and unreadable markup become warnings.
 */
export function parsePageBuilder(html: string): PageBuilderDocument {
  if (html.trim() === '') return { isPageBuilder: false, nodes: [], warnings: [] };
  if (!isPageBuilderContent(html)) {
    return {
      isPageBuilder: false,
      nodes: [{ type: 'fragment', html: sanitizeTrustedHtml(html), box: EMPTY_BOX, children: [] }],
      warnings: [],
    };
  }

  const fragment = parseHtml(html);
  const sheets = findAll(fragment, (element) => element.tagName === 'style').map((style) =>
    textContent(style),
  );
  const context: ParseContext = { styles: parsePageBuilderStyles(sheets), warnings: new Set() };
  const nodes = walk(fragment, context);
  return { isPageBuilder: true, nodes, warnings: [...context.warnings] };
}

interface ParseContext {
  readonly styles: PageBuilderStyles;
  readonly warnings: Set<string>;
}

type Aggregate = (element: Element, context: ParseContext, children: ContentNode[]) => ContentNode;

const EMPTY_BOX: Box = { style: {}, styleId: null, mediaStyles: [], classes: [], hidden: false };

/** Collects content types in document order; plain elements are walked through. */
function walk(parent: ParentNode, context: ParseContext): ContentNode[] {
  const nodes: ContentNode[] = [];
  for (const element of childElements(parent)) {
    if (element.tagName === 'style') continue;
    const contentType = attr(element, 'data-content-type');
    if (!contentType) {
      nodes.push(...walk(element, context));
      continue;
    }
    const children = walk(element, context);
    const aggregate = AGGREGATORS[contentType];
    if (!aggregate) {
      context.warnings.add(`unsupported content type: ${contentType}`);
      nodes.push({ type: 'unknown', contentType, box: EMPTY_BOX, children });
      continue;
    }
    try {
      nodes.push(aggregate(element, context, children));
    } catch {
      context.warnings.add(`unreadable content type: ${contentType}`);
      nodes.push({ type: 'unknown', contentType, box: EMPTY_BOX, children });
    }
  }
  return nodes;
}

// --- Style helpers -----------------------------------------------------------

type Matcher = string | RegExp;

const SPACING: Matcher[] = [/^margin(-|$)/, /^padding(-|$)/];
const BORDER: Matcher[] = [/^border(-|$)/];
const TEXT_ALIGN: Matcher[] = ['text-align'];
const ADVANCED: Matcher[] = [...SPACING, ...BORDER, ...TEXT_ALIGN];
const BACKGROUND: Matcher[] = [
  'background-color',
  'background-size',
  'background-position',
  'background-attachment',
  'background-repeat',
];
const FLEX: Matcher[] = ['display', 'justify-content', 'flex-direction', 'align-self'];

/** Inline `style` merged with the element's `<style>` rule (the rule wins, as in legacy). */
function declarationsOf(element: Element | null, context: ParseContext): Declarations {
  if (!element) return {};
  const id = attr(element, 'data-pb-style');
  return {
    ...parseDeclarations(attr(element, 'style') ?? ''),
    ...(id ? context.styles.base.get(id) : undefined),
  };
}

function pick(declarations: Declarations, matchers: readonly Matcher[]): CssStyle {
  const picked: Record<string, string> = {};
  for (const [property, value] of Object.entries(declarations)) {
    if (matchers.some((m) => (typeof m === 'string' ? m === property : m.test(property)))) {
      picked[property] = value;
    }
  }
  return toReactStyle(picked);
}

function styleOf(element: Element | null, context: ParseContext, matchers: readonly Matcher[]) {
  return pick(declarationsOf(element, context), matchers);
}

/**
 * Box of a content type: `styleElement` holds its styles and responsive
 * rules, `classElement` its admin classes, `hiddenElement` its `display`.
 */
function boxOf(
  context: ParseContext,
  options: {
    readonly styleElement: Element | null;
    readonly matchers: readonly Matcher[];
    readonly classElement?: Element | null;
    readonly hiddenElement?: Element | null;
  },
): Box {
  const { styleElement, matchers } = options;
  const classElement = options.classElement === undefined ? styleElement : options.classElement;
  const hiddenElement = options.hiddenElement === undefined ? styleElement : options.hiddenElement;
  const styleId = styleElement ? attr(styleElement, 'data-pb-style') : null;
  return {
    style: styleOf(styleElement, context, matchers),
    styleId,
    mediaStyles: styleId ? (context.styles.media.get(styleId) ?? []) : [],
    classes: classElement ? classList(classElement) : [],
    hidden: declarationsOf(hiddenElement, context).display === 'none',
  };
}

// --- Attribute helpers -------------------------------------------------------

/** Magento stores JSON attributes with escaped quotes (`{\"a\":1}`). */
function parseJsonAttribute(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value.replace(/\\"/g, '"'));
  } catch {
    return null;
  }
}

function backgroundImages(element: Element | null): BackgroundImages {
  const parsed = parseJsonAttribute(element ? attr(element, 'data-background-images') : null);
  const record = isRecord(parsed) ? parsed : {};
  return { desktop: stringOrNull(record.desktop_image), mobile: stringOrNull(record.mobile_image) };
}

function videoFallback(element: Element | null): string | null {
  if (!element || attr(element, 'data-background-type') !== 'video') return null;
  return stringOrNull(attr(element, 'data-video-fallback-src'));
}

function linkOf(element: Element | null): Link | null {
  if (!element || element.tagName !== 'a') return null;
  const href = attr(element, 'href')?.trim();
  if (!href) return null;
  return { href, openInNewTab: attr(element, 'target') === '_blank' };
}

function buttonType(element: Element): ButtonType {
  if (hasClass(element, 'pagebuilder-button-secondary')) return 'secondary';
  if (hasClass(element, 'pagebuilder-button-link')) return 'link';
  return 'primary';
}

function showSetting(value: string | null): ShowSetting {
  return value === 'hover' || value === 'never' ? value : 'always';
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function text(element: Element | null): string {
  return element ? textContent(element).replace(/\s+/g, ' ').trim() : '';
}

function firstElementChild(element: Element): Element | null {
  return childElements(element)[0] ?? null;
}

// --- Aggregators -------------------------------------------------------------

const row: Aggregate = (element, context, children) => {
  const appearance = oneOf(
    attr(element, 'data-appearance'),
    ['contained', 'full-width', 'full-bleed'] as const,
    'contained',
  );
  const dataElement =
    appearance === 'contained' ? (firstElementChild(element) ?? element) : element;
  const box = boxOf(context, {
    styleElement: dataElement,
    matchers: ['min-height', ...BACKGROUND, ...FLEX, ...ADVANCED],
  });
  return {
    type: 'row',
    appearance,
    // Hidden from either the outer (legacy) or the inner element.
    box: { ...box, hidden: box.hidden || declarationsOf(element, context).display === 'none' },
    background: backgroundImages(dataElement),
    videoFallbackSrc: videoFallback(dataElement),
    children,
  };
};

const columnGroup: Aggregate = (element, context, children) => ({
  type: attr(element, 'data-content-type') === 'column-line' ? 'column-line' : 'column-group',
  box: boxOf(context, { styleElement: element, matchers: ['display', 'width'] }),
  children,
});

const column: Aggregate = (element, context, children) => ({
  type: 'column',
  box: boxOf(context, {
    styleElement: element,
    matchers: ['min-height', 'width', ...BACKGROUND, ...FLEX, ...ADVANCED],
  }),
  background: backgroundImages(element),
  children,
});

const textType: Aggregate = (element, context, children) => ({
  type: 'text',
  html: sanitizeTrustedHtml(innerHtml(element)),
  box: boxOf(context, { styleElement: element, matchers: ADVANCED }),
  children,
});

const heading: Aggregate = (element, context, children) => {
  const level = Number(element.tagName.replace(/^h/, ''));
  return {
    type: 'heading',
    level: (level >= 1 && level <= 6 ? level : 2) as 1 | 2 | 3 | 4 | 5 | 6,
    text: text(element),
    box: boxOf(context, { styleElement: element, matchers: ADVANCED }),
    children,
  };
};

const image: Aggregate = (element, context, children) => {
  const linkElement = findFirst(element, (child) => child.tagName === 'a');
  const images = findAll(element, (child) => child.tagName === 'img');
  const desktopElement = images.find((img) => attr(img, 'data-element') === 'desktop_image');
  const mobileElement = images.find((img) => attr(img, 'data-element') === 'mobile_image');
  const desktop = desktopElement ? imageSource(desktopElement) : null;
  const mobileSource = mobileElement ? imageSource(mobileElement) : null;
  // Legacy: with no desktop image, the first image is the mobile one; the same url twice is one image.
  const mobile =
    mobileSource && mobileSource.src !== desktop?.src
      ? mobileSource
      : desktop || !images[0]
        ? null
        : imageSource(images[0]);
  const first = desktopElement ?? mobileElement ?? images[0] ?? null;
  const caption = findFirst(element, (child) => child.tagName === 'figcaption');
  return {
    type: 'image',
    desktop,
    mobile,
    alt: first ? (attr(first, 'alt') ?? '') : '',
    title: first ? stringOrNull(attr(first, 'title')) : null,
    link: linkOf(linkElement),
    caption: caption ? text(caption) || null : null,
    imageStyle: styleOf(first, context, BORDER),
    box: boxOf(context, { styleElement: element, matchers: [...SPACING, ...TEXT_ALIGN] }),
    children,
  };
};

function imageSource(element: Element): ImageSource | null {
  const src = stringOrNull(attr(element, 'src'));
  if (!src) return null;
  const dimensions = parseJsonAttribute(attr(element, 'data-image-dimensions'));
  const size = (key: string) => {
    const value = isRecord(dimensions) ? Number(dimensions[key]) : NaN;
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  };
  return { src, width: size('width'), height: size('height') };
}

const banner: Aggregate = (element, context, children) => {
  const contentType = attr(element, 'data-content-type') === 'slide' ? 'slide' : 'banner';
  const appearance = oneOf<BannerAppearance>(
    attr(element, 'data-appearance'),
    ['poster', 'collage-left', 'collage-centered', 'collage-right'],
    'poster',
  );
  const wrapper = byDataElement(element, 'wrapper');
  const overlay = byDataElement(element, 'overlay');
  const buttonElement = byDataElement(element, 'button');
  const content = byDataElement(element, 'content');
  const showButton = showSetting(attr(element, 'data-show-button'));
  const showOverlay = showSetting(attr(element, 'data-show-overlay'));
  const overlayColor = overlay ? stringOrNull(attr(overlay, 'data-overlay-color')) : null;
  // Poster banners size and pad the overlay; collages size and pad the wrapper.
  const sizing = appearance === 'poster' ? overlay : wrapper;
  const sizingStyle = styleOf(sizing, context, ['min-height', /^padding(-|$)/]);
  return {
    type: contentType,
    appearance,
    wrapperStyle: {
      ...styleOf(wrapper, context, [...BACKGROUND, ...TEXT_ALIGN, ...BORDER]),
      ...(appearance === 'poster' ? {} : sizingStyle),
    },
    overlayStyle: appearance === 'poster' ? sizingStyle : {},
    background: backgroundImages(wrapper),
    videoFallbackSrc: videoFallback(wrapper),
    contentHtml: content ? sanitizeTrustedHtml(innerHtml(content)) : '',
    link: linkOf(
      findFirst(
        element,
        (child) => child.tagName === 'a' && attr(child, 'data-element') === 'link',
      ),
    ),
    button:
      buttonElement && showButton !== 'never' && text(buttonElement)
        ? { text: text(buttonElement), type: buttonType(buttonElement), show: showButton }
        : null,
    overlay:
      overlayColor && showOverlay !== 'never' ? { color: overlayColor, show: showOverlay } : null,
    name: stringOrNull(attr(element, 'data-slide-name')),
    box: {
      ...boxOf(context, {
        styleElement: sizing,
        matchers: [],
        classElement: element,
        hiddenElement: element,
      }),
      style: styleOf(element, context, ['margin', /^margin-/]),
    },
    children,
  };
};

const buttons: Aggregate = (element, context, children) => ({
  type: 'buttons',
  appearance: oneOf(attr(element, 'data-appearance'), ['inline', 'stacked'] as const, 'inline'),
  sameWidth: attr(element, 'data-same-width') === 'true',
  box: boxOf(context, { styleElement: element, matchers: ADVANCED }),
  children,
});

const buttonItem: Aggregate = (element, context, children) => {
  const button = firstElementChild(element);
  return {
    type: 'button-item',
    text: text(button),
    buttonType: button ? buttonType(button) : 'primary',
    link: linkOf(button),
    buttonStyle: styleOf(button, context, ADVANCED),
    box: boxOf(context, { styleElement: element, matchers: [] }),
    children,
  };
};

const divider: Aggregate = (element, context, children) => ({
  type: 'divider',
  lineStyle: styleOf(firstElementChild(element), context, [
    'width',
    'border-color',
    'border-width',
  ]),
  box: boxOf(context, { styleElement: element, matchers: ADVANCED }),
  children,
});

const htmlType: Aggregate = (element, context, children) => ({
  type: 'html',
  // Stored escaped (`&lt;p&gt;`); `data-decoded` marks markup Magento left unescaped.
  html: sanitizeTrustedHtml(
    attr(element, 'data-decoded') !== null ? innerHtml(element) : textContent(element),
  ),
  box: boxOf(context, { styleElement: element, matchers: ADVANCED }),
  children,
});

const video: Aggregate = (element, context, children) => {
  const player = findFirst(
    element,
    (child) => child.tagName === 'iframe' || child.tagName === 'video',
  );
  const isFile = player?.tagName === 'video';
  return {
    type: 'video',
    source: parseVideoSource(player ? attr(player, 'src') : null),
    autoplay: isFile && attr(player, 'autoplay') === 'true',
    muted: isFile && attr(player, 'muted') === 'true',
    maxWidth: declarationsOf(firstElementChild(element), context)['max-width'] ?? null,
    wrapperStyle: styleOf(byDataElement(element, 'wrapper'), context, [...BORDER, /^padding(-|$)/]),
    box: boxOf(context, { styleElement: element, matchers: [/^margin(-|$)/, ...TEXT_ALIGN] }),
    children,
  };
};

const map: Aggregate = (element, context, children) => ({
  type: 'map',
  height: declarationsOf(element, context).height ?? null,
  locations: mapLocations(parseJsonAttribute(attr(element, 'data-locations'))),
  box: boxOf(context, { styleElement: element, matchers: ADVANCED }),
  children,
});

function mapLocations(value: unknown): MapLocation[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((location) => {
    const position = isRecord(location.position) ? location.position : {};
    const latitude = Number(position.latitude);
    const longitude = Number(position.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    const country = Array.isArray(location.country) ? location.country.join(' ') : location.country;
    const address = [location.address, location.city, location.state, location.zipcode, country]
      .map(stringOrNull)
      .filter((part): part is string => part !== null)
      .join(', ');
    return [
      {
        name: stringOrNull(location.location_name) ?? '',
        latitude,
        longitude,
        address,
        phone: stringOrNull(location.phone),
      },
    ];
  });
}

const block: Aggregate = (element, context, children) => {
  const inner = firstElementChild(element);
  return {
    type: attr(element, 'data-content-type') === 'dynamic_block' ? 'dynamic_block' : 'block',
    // Static blocks are rendered inline by Magento; nested content types are the children.
    html:
      children.length === 0 && inner && attr(element, 'data-content-type') === 'block'
        ? sanitizeTrustedHtml(innerHtml(inner))
        : '',
    box: boxOf(context, { styleElement: element, matchers: ADVANCED }),
    children,
  };
};

const tabs: Aggregate = (element, context, children) => {
  const [navigation, content] = childElements(element);
  const headers = navigation ? childElements(navigation).map((header) => text(header)) : [];
  const alignment = /tab-align-([a-zA-Z]+)/.exec(attr(element, 'class') ?? '')?.[1] ?? null;
  const active = Number.parseInt(attr(element, 'data-active-tab') ?? '', 10);
  const items = children.filter((child) => child.type === 'tab-item');
  return {
    type: 'tabs',
    defaultIndex: Number.isInteger(active) && active >= 0 && active < items.length ? active : 0,
    navigationAlignment: oneOf(alignment, ['left', 'center', 'right'] as const, 'left'),
    headers,
    contentStyle: styleOf(content ?? null, context, ['min-height', ...TEXT_ALIGN, ...BORDER]),
    box: boxOf(context, {
      styleElement: element,
      matchers: [...SPACING, 'justify-content', 'display', 'flex-direction'],
    }),
    children: items,
  };
};

const tabItem: Aggregate = (element, context, children) => ({
  type: 'tab-item',
  name: stringOrNull(attr(element, 'data-tab-name')) ?? '',
  background: backgroundImages(element),
  box: boxOf(context, {
    styleElement: element,
    matchers: ['min-height', ...BACKGROUND, ...FLEX, ...ADVANCED],
  }),
  children,
});

const DEFAULT_AUTOPLAY_SPEED_MS = 4000;

const slider: Aggregate = (element, context, children) => {
  const speed = Number.parseInt(attr(element, 'data-autoplay-speed') ?? '', 10);
  return {
    type: 'slider',
    autoplay: attr(element, 'data-autoplay') === 'true',
    autoplaySpeed: Number.isInteger(speed) && speed >= 1000 ? speed : DEFAULT_AUTOPLAY_SPEED_MS,
    fade: attr(element, 'data-fade') === 'true',
    infinite: attr(element, 'data-infinite-loop') === 'true',
    showArrows: attr(element, 'data-show-arrows') === 'true',
    showDots: attr(element, 'data-show-dots') === 'true',
    box: boxOf(context, { styleElement: element, matchers: ['min-height', ...ADVANCED] }),
    children: children.filter((child) => child.type === 'slide' || child.type === 'banner'),
  };
};

const products: Aggregate = (element, context, children) => ({
  type: 'products',
  appearance: oneOf(attr(element, 'data-appearance'), ['grid', 'carousel'] as const, 'grid'),
  // `.product-item-details > .product-item-name > a.product-item-link`
  productHrefs: findAll(
    element,
    (link) =>
      link.tagName === 'a' &&
      hasClass(link, 'product-item-link') &&
      parentHasClass(link, 'product-item-name') &&
      parentHasClass(link.parentNode as Element, 'product-item-details'),
  ).flatMap((link) => stringOrNull(attr(link, 'href')) ?? []),
  box: boxOf(context, { styleElement: element, matchers: ADVANCED }),
  children,
});

function parentHasClass(element: Element, name: string): boolean {
  const parent = element.parentNode;
  return parent !== null && isElement(parent) && hasClass(parent, name);
}

const AGGREGATORS: Readonly<Record<string, Aggregate>> = {
  row,
  'column-group': columnGroup,
  'column-line': columnGroup,
  column,
  text: textType,
  heading,
  image,
  banner,
  slide: banner,
  buttons,
  'button-item': buttonItem,
  divider,
  html: htmlType,
  video,
  map,
  block,
  dynamic_block: block,
  tabs,
  'tab-item': tabItem,
  slider,
  products,
};
