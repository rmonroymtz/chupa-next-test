import type {
  ContentNode,
  PageBuilderDocument,
  ProductsNode,
} from '@/modules/page-builder/domain/content-node';
import { toProductUrlKeys } from '@/modules/page-builder/domain/product-url-keys';
import {
  hasDirectives,
  hasMediaDirective,
  resolveDirectives,
} from '@/modules/page-builder/parser/directives';
import { parsePageBuilder } from '@/modules/page-builder/parser/parse-page-builder';
import type { ProductListRepository } from '@/modules/product/application/ports';
import type { ProductCard } from '@/modules/product/domain/product';
import { DEFAULT_PRODUCT_URL_SUFFIX } from '@/modules/product/domain/product-url';

/** Store settings the content needs (a subset of `StoreConfig`). */
export interface PageBuilderStoreSettings {
  readonly productUrlSuffix: string;
  readonly baseMediaUrl: string | null;
}

export interface PageBuilderLogger {
  warn(context: Record<string, unknown>, message: string): void;
  error(context: Record<string, unknown>, message: string): void;
}

export interface PageBuilderLoaderDeps {
  /** Read only when the content has products or media directives. */
  readonly storeConfig: { get(): Promise<PageBuilderStoreSettings> };
  readonly products: ProductListRepository;
  readonly logger: PageBuilderLogger;
}

/** Parsed content plus the data its content types need, ready to render. */
export interface PageBuilderView {
  readonly document: PageBuilderDocument;
  /** Cards for a `products` node, in admin order (empty when none or on failure). */
  productsFor(node: ProductsNode): readonly ProductCard[];
}

export interface PageBuilderLoader {
  /** Never rejects: failures degrade content and are logged. `source` identifies the page in logs. */
  load(content: string, source: string): Promise<PageBuilderView>;
}

export function createPageBuilderLoader(deps: PageBuilderLoaderDeps): PageBuilderLoader {
  return {
    async load(content, source) {
      let settings: Promise<PageBuilderStoreSettings | null> | undefined;
      // One storeConfig read per page, only if something needs it.
      const storeSettings = () =>
        (settings ??= deps.storeConfig.get().catch((error: unknown) => {
          deps.logger.error({ source, err: error }, 'page builder store config failed');
          return null;
        }));

      let html = content;
      if (hasDirectives(html)) {
        const mediaBaseUrl = hasMediaDirective(html)
          ? ((await storeSettings())?.baseMediaUrl ?? null)
          : null;
        const resolved = resolveDirectives(html, { mediaBaseUrl });
        html = resolved.html;
        if (resolved.stripped.length > 0) {
          deps.logger.warn(
            { source, directives: [...new Set(resolved.stripped)] },
            'page builder directives stripped',
          );
        }
      }

      const document = parsePageBuilder(html);
      if (document.warnings.length > 0) {
        deps.logger.warn({ source, warnings: document.warnings }, 'page builder content degraded');
      }

      const productNodes = collectProducts(document.nodes);
      const cardsByNode = new Map<ProductsNode, readonly ProductCard[]>();
      if (productNodes.length > 0) {
        const suffix = (await storeSettings())?.productUrlSuffix ?? DEFAULT_PRODUCT_URL_SUFFIX;
        const keysByNode = new Map(
          productNodes.map((node) => [node, toProductUrlKeys(node.productHrefs, suffix)]),
        );
        const allKeys = [...new Set([...keysByNode.values()].flat())];
        const cards = await deps.products.findByUrlKeys(allKeys).catch((error: unknown) => {
          deps.logger.error({ source, err: error }, 'page builder products failed');
          return [] as ProductCard[];
        });
        const byKey = new Map(cards.map((item) => [item.urlKey, item]));
        for (const [node, keys] of keysByNode) {
          cardsByNode.set(
            node,
            keys.flatMap((key) => byKey.get(key) ?? []),
          );
        }
      }

      return { document, productsFor: (node) => cardsByNode.get(node) ?? [] };
    },
  };
}

function collectProducts(nodes: readonly ContentNode[]): ProductsNode[] {
  return nodes.flatMap((node) => [
    ...(node.type === 'products' ? [node] : []),
    ...collectProducts(node.children),
  ]);
}
