import type { CmsPage } from '@/modules/cms/domain/cms-page';

type Nullable<T> = T | null | undefined;

/** Shape selected by CMS_PAGE_QUERY (all fields optional for safety). */
export interface CmsPageDto {
  identifier?: Nullable<string>;
  url_key?: Nullable<string>;
  relative_url?: Nullable<string>;
  title?: Nullable<string>;
  content?: Nullable<string>;
  content_heading?: Nullable<string>;
  meta_title?: Nullable<string>;
  meta_description?: Nullable<string>;
  meta_keywords?: Nullable<string>;
  page_layout?: Nullable<string>;
}

/** Null when Magento returned no usable page (no identifier). */
export function mapCmsPage(dto: Nullable<CmsPageDto>, identifier: string): CmsPage | null {
  if (!dto) return null;
  const pageIdentifier = blankToNull(dto.identifier) ?? identifier;
  const urlKey = blankToNull(dto.url_key);
  return {
    identifier: pageIdentifier,
    urlKey,
    // Magento returns no relative_url for some pages (e.g. `home`).
    relativeUrl: (blankToNull(dto.relative_url) ?? urlKey ?? pageIdentifier).replace(/^\/+/, ''),
    title: blankToNull(dto.title) ?? '',
    contentHeading: blankToNull(dto.content_heading),
    content: dto.content ?? '',
    metaTitle: blankToNull(dto.meta_title),
    metaDescription: blankToNull(dto.meta_description),
    metaKeywords: blankToNull(dto.meta_keywords),
    pageLayout: blankToNull(dto.page_layout),
  };
}

function blankToNull(value: Nullable<string>): string | null {
  return value && value.trim() !== '' ? value.trim() : null;
}
