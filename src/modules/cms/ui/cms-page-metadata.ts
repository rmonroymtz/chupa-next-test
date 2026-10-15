import type { Metadata } from 'next';
import type { CmsPage } from '@/modules/cms/domain/cms-page';
import { htmlToPlainText } from '@/modules/product/ui/html-to-text';
import { withoutSiteNameSuffix } from '@/modules/seo/domain/page-title';
import { OG_LOCALE, SITE_NAME } from '@/modules/seo/domain/site';

const DESCRIPTION_LENGTH = 160;

/**
 * Head metadata for a CMS page that exists in Magento: indexable for every
 * visitor, canonical from Magento's relative url.
 */
export function buildCmsPageMetadata(page: CmsPage, canonicalUrl: string): Metadata {
  const title =
    [page.metaTitle, page.title, page.contentHeading]
      .map((value) => withoutSiteNameSuffix(value))
      .find(Boolean) ?? SITE_NAME;
  const description = toDescription(page.metaDescription);
  const withDescription = description ? { description } : {};
  return {
    title,
    ...withDescription,
    ...(page.metaKeywords?.trim() ? { keywords: page.metaKeywords.trim() } : {}),
    robots: { index: true, follow: true },
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
