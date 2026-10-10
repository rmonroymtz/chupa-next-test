import Image from 'next/image';
import type { RelatedProduct } from '@/modules/product/domain/product';
import { formatPrice } from '@/modules/product/ui/format-price';
import { isOptimizableImageUrl, parseImageRemoteHosts } from '@/shared/config/image-hosts';

const REMOTE_PATTERNS = parseImageRemoteHosts(process.env.IMAGE_REMOTE_HOSTS);

interface RelatedProductsProps {
  readonly items: readonly RelatedProduct[];
  readonly heading: string;
}

/**
 * Alternatives shown on the PDP. Plain anchors on purpose: `next/link` would
 * prefetch product pages, and a prefetched missing product would query the
 * scraper API and fire the copy mutation without a real visit.
 */
export function RelatedProducts({ items, heading }: RelatedProductsProps) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="related-products" className="mt-12">
      <h2 id="related-products" className="mb-4 text-xl font-semibold">
        {heading}
      </h2>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <li key={item.uid}>
            <a href={`/${item.relativeUrl}`} className="group flex flex-col gap-2">
              <div className="relative aspect-square overflow-hidden rounded bg-white">
                {item.image ? (
                  <Image
                    src={item.image.url}
                    alt={item.image.label ?? item.name}
                    fill
                    sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                    className="object-contain"
                    unoptimized={!isOptimizableImageUrl(item.image.url, REMOTE_PATTERNS)}
                  />
                ) : null}
              </div>
              <span className="line-clamp-2 text-sm group-hover:underline">{item.name}</span>
              {item.price ? (
                <span className="text-sm font-semibold">
                  {formatPrice(item.price.amount, item.price.currency)}
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
