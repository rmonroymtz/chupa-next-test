import type { Metadata } from 'next';
import type { ProductPageDecision } from '@/modules/product/application/product-page-service';
import type { MagentoProduct } from '@/modules/product/domain/product';
import { htmlToPlainText } from '@/modules/product/ui/html-to-text';
import { OG_LOCALE, SITE_NAME } from '@/modules/seo/domain/site';

const DESCRIPTION_LENGTH = 160;

/**
 * Head metadata for a page decision. Indexability is the same for every
 * visitor. Only products stored in Magento get titles, descriptions and
 * social cards; pages missing from Magento stay `noindex, follow` and make
 * no product claims (scraped data is streamed later and never blocks the head).
 */
export function buildProductPageMetadata(decision: ProductPageDecision): Metadata {
  switch (decision.kind) {
    case 'magento_product':
      return magentoProductMetadata(decision.product, decision.canonicalUrl, decision.robots);
    case 'missing_product':
      return {
        robots: { index: decision.robots.index, follow: decision.robots.follow },
        alternates: { canonical: decision.canonicalUrl },
      };
    case 'cms':
      // Placeholder content until T6 renders CMS pages: keep it out of the index.
      return { robots: { index: false, follow: true } };
    default:
      // Redirects and 404s are handled by the page before anything is sent.
      return {};
  }
}

function magentoProductMetadata(
  product: MagentoProduct,
  canonicalUrl: string,
  robots: { readonly index: boolean; readonly follow: boolean },
): Metadata {
  const title = product.metaTitle ?? product.name;
  const description = productDescription(product);
  const images = product.images.map((image) => ({
    url: image.url,
    alt: image.label ?? product.name,
  }));
  const withDescription = description ? { description } : {};
  return {
    title,
    ...withDescription,
    robots: { index: robots.index, follow: robots.follow },
    alternates: { canonical: canonicalUrl },
    openGraph: {
      // Next has no `product` Open Graph type; `website` is the closest valid one.
      type: 'website',
      url: canonicalUrl,
      title,
      ...withDescription,
      siteName: SITE_NAME,
      locale: OG_LOCALE,
      // Magento returns no image dimensions, so none are declared.
      ...(images.length > 0 ? { images } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      ...withDescription,
      ...(images[0] ? { images: [images[0].url] } : {}),
    },
  };
}

/** Meta description, or the short description when the meta one has no text. */
function productDescription(product: MagentoProduct): string | null {
  const text =
    flatten(htmlToPlainText(product.metaDescription ?? '')) ||
    flatten(htmlToPlainText(product.shortDescriptionHtml));
  return text ? truncate(text) : null;
}

function flatten(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Cuts at the last word boundary that fits, ending with an ellipsis. */
function truncate(text: string): string {
  if (text.length <= DESCRIPTION_LENGTH) return text;
  const slice = text.slice(0, DESCRIPTION_LENGTH - 1);
  const boundary = slice.lastIndexOf(' ');
  return `${(boundary > 0 ? slice.slice(0, boundary) : slice).trimEnd()}…`;
}
