import { buildCategorySearchUrl } from '@/modules/layout/domain/search';

/** A Magento category as the header menu needs it. */
export interface CategoryNode {
  readonly uid: string;
  readonly name: string;
  readonly urlPath: string;
  readonly position: number;
  readonly includeInMenu: boolean;
  readonly children: readonly CategoryNode[];
}

/** Children of the store root category plus the store's category url suffix. */
export interface CategoryTree {
  readonly categoryUrlSuffix: string;
  readonly roots: readonly CategoryNode[];
}

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  /** Legacy megamenu and mobile navigation link (search page). */
  readonly searchHref: string;
  /** Category page url (`/{url_path}{suffix}`), used by the legacy desktop submenu. */
  readonly categoryHref: string;
  readonly children: readonly MenuItem[];
}

/**
 * Legacy `useMegaMenu.processData`: at every level keep categories with
 * `include_in_menu` and order them by `position` (ties keep Magento order).
 * Categories without a name or url path cannot be linked and are skipped.
 */
export function buildCategoryMenu(tree: CategoryTree): MenuItem[] {
  return toItems(tree.roots, tree.categoryUrlSuffix);
}

function toItems(nodes: readonly CategoryNode[], suffix: string): MenuItem[] {
  return nodes
    .filter((node) => node.includeInMenu && node.name !== '' && node.urlPath !== '')
    .map((node, index) => ({ node, index }))
    .sort((a, b) => a.node.position - b.node.position || a.index - b.index)
    .map(({ node }) => ({
      id: node.uid,
      label: node.name,
      searchHref: buildCategorySearchUrl(node.urlPath),
      categoryHref: `/${node.urlPath}${suffix}`,
      children: toItems(node.children, suffix),
    }));
}
