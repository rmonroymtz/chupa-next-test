import type {
  ContentNode,
  PageBuilderDocument,
  ProductsNode,
} from '@/modules/page-builder/domain/content-node';
import { toProductUrlKeys } from '@/modules/page-builder/domain/product-url-keys';
import { scanDirectives } from '@/modules/page-builder/parser/directive-scanner';
import { resolveDirectives } from '@/modules/page-builder/parser/directives';
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
  /**
   * Cards for a `products` node, in admin order (empty when none or on failure).
   * Never rejects; resolves after the view so the products can stream.
   */
  productsFor(node: ProductsNode): Promise<readonly ProductCard[]>;
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
      // Started now but not awaited: the page streams while the products load.
      const cardsByNode =
        productNodes.length > 0
          ? loadCards(productNodes, source, deps, storeSettings)
          : Promise.resolve(new Map<ProductsNode, readonly ProductCard[]>());

      return {
        document,
        productsFor: async (node) => (await cardsByNode).get(node) ?? [],
      };
    },
  };
}

/** Never rejects: a failure leaves the cards empty and is logged. */
async function loadCards(
  productNodes: readonly ProductsNode[],
  source: string,
  deps: PageBuilderLoaderDeps,
  storeSettings: () => Promise<PageBuilderStoreSettings | null>,
): Promise<Map<ProductsNode, readonly ProductCard[]>> {
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
  return new Map(
    [...keysByNode].map(([node, keys]) => [
      node,
      uniqueCards(keys.flatMap((key) => byKey.get(key) ?? [])),
    ]),
  );
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
    // One scan, shared by the media check and the resolver.
    const matches = scanDirectives(content);
    if (matches.length === 0) return content;
    const mediaBaseUrl = matches.some((match) => match.name === 'media')
      ? ((await storeSettings())?.baseMediaUrl ?? null)
      : null;
    const { html, stripped } = resolveDirectives(content, { mediaBaseUrl }, matches);
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

/**
 * Products nodes that render, so hidden ones cost no query. Same rule as the
 * renderer: a hidden node is dropped with its subtree, except a tab item, whose
 * panel the tabs always draw.
 */
function collectProducts(nodes: readonly ContentNode[]): ProductsNode[] {
  return nodes.flatMap((node) =>
    node.box.hidden && node.type !== 'tab-item'
      ? []
      : [...(node.type === 'products' ? [node] : []), ...collectProducts(node.children)],
  );
}
