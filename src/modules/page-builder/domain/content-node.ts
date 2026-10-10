/**
 * Typed tree of Magento Page Builder content types, produced on the server
 * from the "master format" storage HTML. Pure domain types: no framework
 * imports and no I/O.
 */

/** Inline CSS declarations, camelCased (React `style` compatible). */
export type CssStyle = Readonly<Record<string, string>>;

/** Responsive rule Magento emitted for one element (`@media ... { [data-pb-style=ID] { ... } }`). */
export interface MediaStyle {
  readonly media: string;
  /** Kebab-case declarations, e.g. `min-height: 300px`. */
  readonly declarations: Readonly<Record<string, string>>;
}

/** Styling shared by every content type. */
export interface Box {
  /** Declarations applied inline (Magento inline styles merged with its `<style>` rules). */
  readonly style: CssStyle;
  /**
   * `data-pb-style` id, kept so responsive rules can target the rendered
   * element (for banners: the overlay in `poster`, the wrapper otherwise).
   */
  readonly styleId: string | null;
  readonly mediaStyles: readonly MediaStyle[];
  /** Admin CSS classes (`class` attribute). */
  readonly classes: readonly string[];
  /** `display: none` set in the admin. */
  readonly hidden: boolean;
}

export interface BackgroundImages {
  readonly desktop: string | null;
  readonly mobile: string | null;
}

export interface Link {
  readonly href: string;
  readonly openInNewTab: boolean;
}

export type ButtonType = 'primary' | 'secondary' | 'link';

export interface ImageSource {
  readonly src: string;
  /** From `data-image-dimensions` when Magento stored them. */
  readonly width: number | null;
  readonly height: number | null;
}

interface NodeBase {
  readonly box: Box;
  readonly children: readonly ContentNode[];
}

export interface RowNode extends NodeBase {
  readonly type: 'row';
  readonly appearance: 'contained' | 'full-width' | 'full-bleed';
  /** Background images (rendered with CSS; parallax degrades to a static background). */
  readonly background: BackgroundImages;
  /** Video background degrades to its fallback image (no autoplaying video backgrounds). */
  readonly videoFallbackSrc: string | null;
}

export interface ColumnGroupNode extends NodeBase {
  readonly type: 'column-group' | 'column-line';
}

export interface ColumnNode extends NodeBase {
  readonly type: 'column';
  readonly background: BackgroundImages;
}

export interface TextNode extends NodeBase {
  readonly type: 'text';
  readonly html: string;
}

export interface HeadingNode extends NodeBase {
  readonly type: 'heading';
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  readonly text: string;
}

export interface ImageNode extends NodeBase {
  readonly type: 'image';
  readonly desktop: ImageSource | null;
  readonly mobile: ImageSource | null;
  readonly alt: string;
  readonly title: string | null;
  readonly link: Link | null;
  readonly caption: string | null;
  /** Border declarations of the `<img>` itself. */
  readonly imageStyle: CssStyle;
}

export type BannerAppearance = 'poster' | 'collage-left' | 'collage-centered' | 'collage-right';
export type ShowSetting = 'always' | 'hover' | 'never';

export interface BannerNode extends NodeBase {
  /** `slide` is a banner inside a slider. */
  readonly type: 'banner' | 'slide';
  readonly appearance: BannerAppearance;
  readonly wrapperStyle: CssStyle;
  readonly overlayStyle: CssStyle;
  readonly background: BackgroundImages;
  readonly videoFallbackSrc: string | null;
  readonly contentHtml: string;
  readonly link: Link | null;
  readonly button: {
    readonly text: string;
    readonly type: ButtonType;
    readonly show: ShowSetting;
  } | null;
  readonly overlay: { readonly color: string; readonly show: ShowSetting } | null;
  /** Accessible name for the slide (`data-slide-name`). */
  readonly name: string | null;
}

export interface ButtonsNode extends NodeBase {
  readonly type: 'buttons';
  readonly appearance: 'inline' | 'stacked';
  readonly sameWidth: boolean;
}

export interface ButtonItemNode extends NodeBase {
  readonly type: 'button-item';
  readonly text: string;
  readonly buttonType: ButtonType;
  readonly link: Link | null;
  /** Declarations of the button element itself. */
  readonly buttonStyle: CssStyle;
}

export interface DividerNode extends NodeBase {
  readonly type: 'divider';
  readonly lineStyle: CssStyle;
}

export interface HtmlNode extends NodeBase {
  /** `html` content type, or legacy content without Page Builder markup (`fragment`). */
  readonly type: 'html' | 'fragment';
  /** Trusted admin HTML, already sanitized of scripts and event handlers. */
  readonly html: string;
}

export interface VideoNode extends NodeBase {
  readonly type: 'video';
  readonly source: VideoSource | null;
  readonly autoplay: boolean;
  readonly muted: boolean;
  readonly maxWidth: string | null;
  readonly wrapperStyle: CssStyle;
}

export type VideoSource =
  | { readonly kind: 'youtube'; readonly id: string }
  | { readonly kind: 'vimeo'; readonly id: string }
  | { readonly kind: 'file'; readonly url: string };

export interface MapLocation {
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly address: string;
  readonly phone: string | null;
}

export interface MapNode extends NodeBase {
  readonly type: 'map';
  readonly height: string | null;
  readonly locations: readonly MapLocation[];
}

export interface BlockNode extends NodeBase {
  /** Static block (content is inline in the storage HTML) or dynamic block. */
  readonly type: 'block' | 'dynamic_block';
  /** Inner HTML used when the block holds no Page Builder content types. */
  readonly html: string;
}

export interface TabsNode extends NodeBase {
  readonly type: 'tabs';
  readonly defaultIndex: number;
  readonly navigationAlignment: 'left' | 'center' | 'right';
  readonly headers: readonly string[];
  readonly contentStyle: CssStyle;
}

export interface TabItemNode extends NodeBase {
  readonly type: 'tab-item';
  readonly name: string;
  readonly background: BackgroundImages;
}

export interface SliderNode extends NodeBase {
  readonly type: 'slider';
  readonly autoplay: boolean;
  /** Milliseconds between slides. */
  readonly autoplaySpeed: number;
  readonly fade: boolean;
  readonly infinite: boolean;
  readonly showArrows: boolean;
  readonly showDots: boolean;
}

export interface ProductsNode extends NodeBase {
  readonly type: 'products';
  readonly appearance: 'grid' | 'carousel';
  /** Product link hrefs in admin order (`a.product-item-link`). */
  readonly productHrefs: readonly string[];
}

/** A content type this renderer does not support; only its children render. */
export interface UnknownNode extends NodeBase {
  readonly type: 'unknown';
  readonly contentType: string;
}

export type ContentNode =
  | RowNode
  | ColumnGroupNode
  | ColumnNode
  | TextNode
  | HeadingNode
  | ImageNode
  | BannerNode
  | ButtonsNode
  | ButtonItemNode
  | DividerNode
  | HtmlNode
  | VideoNode
  | MapNode
  | BlockNode
  | TabsNode
  | TabItemNode
  | SliderNode
  | ProductsNode
  | UnknownNode;

export interface PageBuilderDocument {
  /** True when the content carried Page Builder markup (`data-content-type`). */
  readonly isPageBuilder: boolean;
  readonly nodes: readonly ContentNode[];
  /** Unsupported content types and aggregation failures, for one log line per page. */
  readonly warnings: readonly string[];
}
