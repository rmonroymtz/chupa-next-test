import type { Metadata } from 'next';
import type { ProductPageDecision } from '@/modules/product/application/product-page-service';
import { htmlToPlainText } from '@/modules/product/ui/html-to-text';

const DESCRIPTION_LENGTH = 160;

/**
 * Head metadata for a page decision: robots and canonical (indexability is
 * the same for every visitor). Titles and Open Graph are extended in T5.
 */
export function buildProductPageMetadata(decision: ProductPageDecision): Metadata {
  switch (decision.kind) {
    case 'magento_product': {
      const { product, robots, canonicalUrl } = decision;
      const description =
        product.metaDescription !== null
          ? htmlToPlainText(product.metaDescription)
          : htmlToPlainText(product.shortDescriptionHtml);
      return {
        title: product.metaTitle ?? product.name,
        ...(description ? { description: truncate(description) } : {}),
        robots: { index: robots.index, follow: robots.follow },
        alternates: { canonical: canonicalUrl },
      };
    }
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

function truncate(text: string): string {
  const flat = text.replace(/\s+/g, ' ');
  return flat.length <= DESCRIPTION_LENGTH ? flat : `${flat.slice(0, DESCRIPTION_LENGTH - 1)}…`;
}
