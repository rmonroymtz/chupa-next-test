import Image from 'next/image';
import type { ReactNode } from 'react';
import { isOptimizableImageUrl, parseImageRemoteHosts } from '@/shared/config/image-hosts';
import { cx } from './class-names';
import { Rating } from './rating';

const REMOTE_PATTERNS = parseImageRemoteHosts(process.env.IMAGE_REMOTE_HOSTS);

/**
 * Image `sizes` for a card in `ProductGrid`: 2 columns, 4 from 800px, inside
 * the 1260px content column.
 */
export const PRODUCT_GRID_IMAGE_SIZES = '(min-width: 1260px) 315px, (min-width: 800px) 25vw, 50vw';

/**
 * Product listing grid of the live PWA Gallery (`Gallery/gallery.module.css`
 * `.grid`, viewMode `grid`): 2 columns below 800px, 4 from 800px (the legacy
 * `-md` screen is `max-width: 799px`); gaps 8px / 24px row, 16px / 32px row from
 * 1280px (`-xl` is `max-width: 1279px`). `leading-none` is the Gallery root's.
 * Not the DS `productColumns` 2/5/5: the live listing still renders 2/4.
 */
export function ProductGrid({ children }: { readonly children: ReactNode }) {
  return (
    <ul
      data-slot="product-grid"
      className="m-0 grid list-none grid-cols-2 gap-x-2 gap-y-6 p-0 leading-none min-[800px]:grid-cols-4 min-[1280px]:gap-x-4 min-[1280px]:gap-y-8"
    >
      {children}
    </ul>
  );
}

export interface ProductCardImage {
  readonly src: string;
  readonly alt: string;
}

interface ProductCardProps {
  /** Product page path; a plain anchor (next/link would prefetch product pages). */
  readonly href: string;
  readonly name: string;
  readonly image: ProductCardImage | null;
  /** `sizes` of the responsive image for the list the card is in. */
  readonly imageSizes: string;
  /** The rendered price (`Price`), or nothing when the product has none. */
  readonly price: ReactNode;
  /** Review rating (0–5); stars only when above 0. */
  readonly rating?: number | null | undefined;
  /** Brand line of the Gallery card (left blank when unknown). */
  readonly brand?: string | null | undefined;
  /**
   * `gallery`: the PWA Gallery item (listings, Page Builder products, related
   * products). `slider`: the PWA recommendation slider `ProductCard`.
   */
  readonly variant?: 'gallery' | 'slider';
  /** Gallery only: `grid` adds the Gallery grid rows (viewMode `grid`); a carousel has none. */
  readonly layout?: 'grid' | 'plain';
}

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus';

/**
 * Product card matching the live chupaprecios-pwa card. One link per product
 * (the PWA links the image and the name separately; one tab stop here).
 */
export function ProductCard({
  href,
  name,
  image,
  imageSizes,
  price,
  rating,
  brand,
  variant = 'gallery',
  layout = 'grid',
}: ProductCardProps) {
  const picture = image ? (
    <Image
      src={image.src}
      alt={image.alt}
      fill
      sizes={imageSizes}
      className="object-contain"
      unoptimized={!isOptimizableImageUrl(image.src, REMOTE_PATTERNS)}
    />
  ) : null;

  if (variant === 'slider') {
    // RandomSliders/ProductCard/productCard.module.css (legacy values, no DS tokens).
    return (
      <a
        href={href}
        data-slot="product-card"
        className={cx(
          'box-border flex h-full flex-col overflow-hidden rounded-[10px] bg-ds-surface px-[12px] pt-[10px] pb-[12px] text-inherit no-underline',
          'shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] transition-[box-shadow,transform] duration-[180ms] ease-[ease]',
          'hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.05)]',
          'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
          FOCUS,
        )}
      >
        <div
          data-slot="product-card-image"
          className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xs"
        >
          {picture}
        </div>
        <div className="flex flex-1 flex-col pt-2">
          {rating && rating > 0 ? (
            <div data-slot="product-card-rating" className="mb-1">
              <Rating value={rating} variant="slider" />
            </div>
          ) : null}
          {/* #1a1a1a: legacy slider text colour, no identical DS token. */}
          <h3 className="m-0 mb-[6px] line-clamp-2 min-h-[2.8em] text-[12px] leading-[1.4] font-normal text-[#1a1a1a]">
            {name}
          </h3>
          {price}
        </div>
      </a>
    );
  }

  // Gallery/item.js + item.module.css (viewMode `grid`; a Page Builder carousel passes none).
  return (
    <a
      href={href}
      data-slot="product-card"
      className={cx(
        'text-inherit no-underline',
        // `.cardDesktopGridBody`: two children in five fixed rows, so every card is
        // as tall as the image plus 184px, whatever its name or price.
        layout === 'grid' && 'grid grid-rows-[auto_3rem_1.5rem_1.75rem_1.25rem] items-start gap-4',
        FOCUS,
      )}
    >
      <div
        data-slot="product-card-image"
        className="relative flex aspect-square w-full justify-center"
      >
        {/* `.image`: `max-w-[80%]`, full height, contained. */}
        <div className="relative h-full w-[80%]">{picture}</div>
      </div>
      <div>
        <div data-slot="product-card-brand" className="min-h-[1lh] text-center font-bold">
          {brand ?? ''}
        </div>
        <div
          data-slot="product-card-rating"
          className="flex min-h-[24px] items-start justify-center"
        >
          {rating && rating > 0 ? <Rating value={rating} /> : null}
        </div>
        {/* `.cardDesktopTitle`: Roboto Flex 16/400, two lines. */}
        <div className="flex min-h-[48px] items-start justify-center pt-1 text-center font-display text-base font-normal">
          <span className="line-clamp-2 break-words">{name}</span>
        </div>
        {price}
      </div>
    </a>
  );
}
