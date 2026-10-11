import type { CategoryTreeRepository } from '@/modules/layout/application/ports';
import type { CategoryNode, CategoryTree } from '@/modules/layout/domain/category-menu';
import { HEADER_MENU_QUERY } from '@/modules/layout/infrastructure/category-menu.query';
import type { MagentoClient } from '@/shared/graphql/client';

type Nullable<T> = T | null | undefined;

interface CategoryDto {
  uid?: Nullable<string>;
  name?: Nullable<string>;
  include_in_menu?: Nullable<number>;
  position?: Nullable<number>;
  url_path?: Nullable<string>;
  children?: Nullable<Nullable<CategoryDto>[]>;
}

interface HeaderMenuData {
  storeConfig?: Nullable<{ category_url_suffix?: Nullable<string> }>;
  categoryList?: Nullable<Nullable<CategoryDto>[]>;
}

/** Category tree for the header menu (no-store and metered by the Magento client). */
export function createMagentoCategoryTreeRepository(
  client: MagentoClient,
  options: { readonly timeoutMs: number },
): CategoryTreeRepository {
  return {
    async getTree(): Promise<CategoryTree> {
      const data = await client.request<HeaderMenuData>({
        operationName: 'HeaderMenu',
        query: HEADER_MENU_QUERY,
        variables: {},
        timeoutMs: options.timeoutMs,
      });
      const root = data.categoryList?.[0];
      return {
        categoryUrlSuffix: data.storeConfig?.category_url_suffix ?? '',
        roots: mapChildren(root?.children),
      };
    },
  };
}

function mapChildren(children: Nullable<Nullable<CategoryDto>[]>): CategoryNode[] {
  return (children ?? []).flatMap((dto) => (dto ? [mapCategory(dto)] : []));
}

function mapCategory(dto: CategoryDto): CategoryNode {
  return {
    uid: dto.uid ?? '',
    name: typeof dto.name === 'string' ? dto.name.trim() : '',
    urlPath: typeof dto.url_path === 'string' ? dto.url_path : '',
    position: typeof dto.position === 'number' ? dto.position : 0,
    // Magento sends 0/1; the legacy menu tests truthiness.
    includeInMenu: Boolean(dto.include_in_menu),
    children: mapChildren(dto.children),
  };
}
