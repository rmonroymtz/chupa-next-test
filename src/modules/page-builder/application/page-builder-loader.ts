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
import { stripAllDirectives } from '@/modules/page-builder/application/strip-directives';
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

      const html = await resolveContentDirectives(content, source, deps, storeSettings);
      const document = parseSafely(html, source, deps.logger);
      if (document.warnings.length > 0) {
        deps.logger.warn({ source, warnings: document.warnings }, 'page builder content degraded');
      }

      const productNodes = collectProducts(document.nodes);
      const cardsByNode = new Map<ProductsNode, readonly ProductCard[]>();
      if (productNodes.length > 0) {
        const suffix = (await storeSettings())?.productUrlSuffix ?? DEFAULT_PRODUCT_URL_SUFFIX;
        const keysByNode = new Map(
          productNodes.map((node) => [node, productKeys(node, suffix, source, deps.logger)]),
        );
        const allKeys = [...new Set([...keysByNode.values()].flat())];
        const cards =
          allKeys.length === 0
            ? []
            : await deps.products.findByUrlKeys(allKeys).catch((error: unknown) => {
                deps.logger.error({ source, err: error }, 'page builder products failed');
                return [] as ProductCard[];
              });
        const byKey = new Map(cards.map((item) => [item.urlKey, item]));
        for (const [node, keys] of keysByNode) {
          cardsByNode.set(node, uniqueCards(keys.flatMap((key) => byKey.get(key) ?? [])));
        }
      }

      return { document, productsFor: (node) => cardsByNode.get(node) ?? [] };
    },
  };
}

const EMPTY_DOCUMENT: PageBuilderDocument = { isPageBuilder: false, nodes: [], warnings: [] };

async function resolveContentDirectives(
  content: string,
  source: string,
  deps: PageBuilderLoaderDeps,
  storeSettings: () => Promise<PageBuilderStoreSettings | null>,
): Promise<string> {
  try {
    // Only recognized Magento directives are touched; literal `{{text}}` copy stays.
    if (!hasDirectives(content)) return content;
    const mediaBaseUrl = hasMediaDirective(content)
      ? ((await storeSettings())?.baseMediaUrl ?? null)
      : null;
    const { html, stripped } = resolveDirectives(content, { mediaBaseUrl });
    if (stripped.length > 0) {
      deps.logger.warn(
        { source, directives: [...new Set(stripped)] },
        'page builder directives stripped',
      );
    }
    return html;
  } catch (error) {
    // Never show raw directives to shoppers: drop them all and keep the content.
    deps.logger.error({ source, err: error }, 'page builder directives failed');
    return stripAllDirectives(content).html;
  }
}

function parseSafely(html: string, source: string, logger: PageBuilderLogger): PageBuilderDocument {
  try {
    return parsePageBuilder(html);
  } catch (error) {
    logger.error({ source, err: error }, 'page builder parse failed');
    return EMPTY_DOCUMENT;
  }
}

function productKeys(
  node: ProductsNode,
  suffix: string,
  source: string,
  logger: PageBuilderLogger,
): string[] {
  try {
    return toProductUrlKeys(node.productHrefs, suffix);
  } catch (error) {
    logger.error({ source, err: error }, 'page builder product keys failed');
    return [];
  }
}

/** One card per product (url rewrite aliases resolve to the same uid); first wins. */
function uniqueCards(cards: readonly ProductCard[]): ProductCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => !seen.has(card.uid) && Boolean(seen.add(card.uid)));
}

function collectProducts(nodes: readonly ContentNode[]): ProductsNode[] {
  return nodes.flatMap((node) => [
    ...(node.type === 'products' ? [node] : []),
    ...collectProducts(node.children),
  ]);
}
