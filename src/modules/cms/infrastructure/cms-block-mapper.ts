import type { CmsBlock } from '@/modules/cms/domain/cms-block';

type Nullable<T> = T | null | undefined;

/** Shape of one item selected by CMS_BLOCKS_QUERY (all fields optional for safety). */
export interface CmsBlockDto {
  identifier?: Nullable<string>;
  title?: Nullable<string>;
  content?: Nullable<string>;
}

/** Null when Magento returned no usable block (no identifier). */
export function mapCmsBlock(dto: Nullable<CmsBlockDto>): CmsBlock | null {
  const identifier = dto?.identifier?.trim();
  if (!dto || !identifier) return null;
  return {
    identifier,
    title: dto.title?.trim() ?? '',
    content: dto.content ?? '',
  };
}
