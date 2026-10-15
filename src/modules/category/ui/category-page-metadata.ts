import type { Metadata } from 'next';
import type { Category } from '@/modules/category/domain/category';
import { htmlToPlainText } from '@/modules/product/ui/html-to-text';
import { withoutSiteNameSuffix } from '@/modules/seo/domain/page-title';
import { OG_LOCALE, SITE_NAME } from '@/modules/seo/domain/site';

const DESCRIPTION_LENGTH = 160;

interface CategoryPageMetadataOptions {
  /** Clean category url (no page, no query), whatever page is shown. */
  readonly canonicalUrl: string;
  /** False for a category without products: served, but `noindex, follow`. */
  readonly indexable: boolean;
}

/**
 * Head metadata for a category that exists in Magento. The same for every
 * visitor and every page of the listing: the canonical is always the clean
 * category url. The layout's title template adds the site name.
 */
export function buildCategoryPageMetadata(
  category: Category,
  { canonicalUrl, indexable }: CategoryPageMetadataOptions,
): Metadata {
  const title = withoutSiteNameSuffix(category.metaTitle) ?? category.name;
  const description = toDescription(category.metaDescription);
  const withDescription = description ? { description } : {};
  return {
    title,
    ...withDescription,
    robots: { index: indexable, follow: true },
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'website',
      url: canonicalUrl,
      title,
      ...withDescription,
      siteName: SITE_NAME,
      locale: OG_LOCALE,
    },
  };
}

/** One plain-text line, cut at a word boundary (same rule as CMS pages). */
function toDescription(value: string | null): string | null {
  const text = htmlToPlainText(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  if (text.length <= DESCRIPTION_LENGTH) return text;
  const slice = text.slice(0, DESCRIPTION_LENGTH - 1);
  const boundary = slice.lastIndexOf(' ');
  return `${(boundary > 0 ? slice.slice(0, boundary) : slice).trimEnd()}…`;
}
