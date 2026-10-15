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
  /** Category page url (`/{url_path}{suffix}`), the link at every menu level. */
  readonly categoryHref: string;
  readonly children: readonly MenuItem[];
}

/**
 * Legacy `useMegaMenu.processData`: at every level keep categories with
 * `include_in_menu` and order them by `position` (ties keep Magento order).
 * Categories without a name or url path cannot be linked and are skipped.
 *
 * Ids are the Magento `uid` (legacy keys items by it). A category without a
 * uid falls back to its url path, unique per store; any later repeat of an
 * id anywhere in the tree is dropped so ids stay unique.
 */
export function buildCategoryMenu(tree: CategoryTree): MenuItem[] {
  return toItems(tree.roots, tree.categoryUrlSuffix, new Set());
}

function toItems(nodes: readonly CategoryNode[], suffix: string, seen: Set<string>): MenuItem[] {
  return nodes
    .filter((node) => node.includeInMenu && node.name !== '' && node.urlPath !== '')
    .map((node, index) => ({ node, index }))
    .sort((a, b) => a.node.position - b.node.position || a.index - b.index)
    .flatMap(({ node }) => {
      const id = node.uid === '' ? `path:${node.urlPath}` : node.uid;
      if (seen.has(id)) return [];
      seen.add(id);
      return [
        {
          id,
          label: node.name,
          categoryHref: `/${node.urlPath}${suffix}`,
          children: toItems(node.children, suffix, seen),
        },
      ];
    });
}
