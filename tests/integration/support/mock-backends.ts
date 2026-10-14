import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/** One request received by a mock backend. */
export interface RecordedCall {
  readonly service: 'magento' | 'chapi';
  /** GraphQL operation name, or the CHAPI path. */
  readonly operation: string;
  readonly body: Record<string, unknown>;
  /** `Authorization` header as received (cart operations of signed-in shoppers). */
  readonly authorization?: string;
  /** Position in the shared event order (see `MockBackends.nextSeq`) when the request arrived. */
  readonly receivedSeq: number;
  /** Event order position when the mock finished responding (after any delay). */
  respondedSeq?: number;
  /** Event order position when the client closed the request before any response (e.g. its timeout). */
  abortedSeq?: number;
}

export interface ChapiScenario {
  readonly status?: number;
  readonly body?: unknown;
  readonly delayMs?: number;
}

export interface MockBackendsConfig {
  /** `route()` payloads by url; `'outage'` answers HTTP 503. Unknown urls resolve null. */
  readonly routes: Readonly<Record<string, Record<string, unknown> | 'outage'>>;
  /**
   * `storeConfig` payload; `'outage'` answers HTTP 503. Changeable at runtime
   * with `MockBackends.setStoreConfig`.
   */
  readonly storeConfig: Record<string, unknown> | 'outage';
  /**
   * `cmsPage` payloads by identifier; `'outage'` answers HTTP 503. Unknown
   * identifiers answer Magento's "doesn't exist" GraphQL error.
   */
  readonly cmsPages?: Readonly<Record<string, Record<string, unknown> | 'outage'>>;
  /**
   * `CategoryByUid` categories by uid; `'outage'` answers HTTP 503. Unknown
   * uids answer an empty `categoryList` (Magento's missing or disabled
   * category). The store's category suffix is `.html`.
   */
  readonly categories?: Readonly<Record<string, Record<string, unknown> | 'outage'>>;
  /**
   * `CategoryProducts` items by category uid, paginated like Magento with the
   * requested `pageSize`; `'outage'` answers HTTP 503. Unknown uids have no
   * products.
   */
  readonly categoryProducts?: Readonly<
    Record<string, readonly Record<string, unknown>[] | 'outage'>
  >;
  /** `products(filter: {url_key: {in}})` items by url key. */
  readonly productsByUrlKey?: Readonly<Record<string, Record<string, unknown>>>;
  /**
   * `HeaderMenu` payload (`storeConfig` + `categoryList`); `'outage'` answers
   * HTTP 503. Unset answers HTTP 400 like any unknown operation. Changeable
   * at runtime with `MockBackends.setMenu`.
   */
  readonly menu?: Record<string, unknown> | 'outage';
  /** Delay before answering `HeaderMenu`; changeable with `MockBackends.setMenuDelay`. */
  readonly menuDelayMs?: number;
  /** CHAPI answers by `${store}:${sku}`; unknown keys answer an empty `data`. */
  readonly chapi: Readonly<Record<string, ChapiScenario>>;
  readonly chapiDefaultDelayMs: number;
}

export interface MockBackends {
  readonly magentoUrl: string;
  readonly chapiUrl: string;
  readonly calls: RecordedCall[];
  /**
   * Next position in one monotonic event order shared by the mocks and the
   * test client (same process). Ordering assertions compare positions instead
   * of wall-clock timestamps, so they never depend on timer resolution.
   */
  nextSeq(): number;
  callsTo(service: RecordedCall['service'], operation?: string): RecordedCall[];
  /** Replaces the `HeaderMenu` answer for the following requests. */
  setMenu(menu: MockBackendsConfig['menu']): void;
  /** Delays the following `HeaderMenu` answers by `ms`. */
  setMenuDelay(ms: number): void;
  /** Replaces the `StoreConfig` answer for the following requests. */
  setStoreConfig(storeConfig: MockBackendsConfig['storeConfig']): void;
  /** Cart ids the mock Magento knows, with their items (see the cart operations). */
  readonly carts: ReadonlyMap<string, MockCartItem[]>;
  reset(): void;
  close(): Promise<void>;
}

export interface MockCartItem {
  readonly sku: string;
  quantity: number;
  readonly vendor: string;
}

/** Starts mock Magento GraphQL and CHAPI HTTP servers that record every request. */
export async function startMockBackends(config: MockBackendsConfig): Promise<MockBackends> {
  const calls: RecordedCall[] = [];
  let seq = 0;
  const nextSeq = () => ++seq;
  let menu = config.menu;
  let storeConfig = config.storeConfig;
  let menuDelayMs = config.menuDelayMs ?? 0;
  const carts = new Map<string, MockCartItem[]>();

  const magento = createServer((req, res) => {
    void handle(req, res, nextSeq, async (body) => {
      const operation = String(body.operationName ?? '');
      const call = record('magento', operation, body, res, req.headers.authorization);
      const variables = (body.variables ?? {}) as Record<string, unknown>;
      let response: { status: number; body: unknown };
      if (operation === 'ProductByRoute') {
        const route = config.routes[String(variables.url)];
        response =
          route === 'outage'
            ? { status: 503, body: { message: 'Service Unavailable' } }
            : { status: 200, body: { data: { route: route ?? null } } };
      } else if (operation === 'CmsPage') {
        const identifier = String(variables.identifier);
        const page = config.cmsPages?.[identifier];
        response =
          page === 'outage'
            ? { status: 503, body: { message: 'Service Unavailable' } }
            : page
              ? { status: 200, body: { data: { cmsPage: page } } }
              : {
                  status: 200,
                  body: {
                    errors: [
                      { message: `The CMS page with the "${identifier}" ID doesn't exist.` },
                    ],
                    data: { cmsPage: null },
                  },
                };
      } else if (operation === 'CategoryByUid') {
        const category = config.categories?.[String(variables.uid)];
        response =
          category === 'outage'
            ? { status: 503, body: { message: 'Service Unavailable' } }
            : {
                status: 200,
                body: {
                  data: {
                    storeConfig: { store_code: 'default', category_url_suffix: '.html' },
                    categoryList: category ? [category] : [],
                  },
                },
              };
      } else if (operation === 'CategoryProducts') {
        const items = config.categoryProducts?.[String(variables.uid)] ?? [];
        response =
          items === 'outage'
            ? { status: 503, body: { message: 'Service Unavailable' } }
            : answerCategoryProducts(
                items,
                Number(variables.currentPage),
                Number(variables.pageSize),
              );
      } else if (operation === 'ProductsByUrlKeys') {
        const keys = Array.isArray(variables.urlKeys) ? variables.urlKeys.map(String) : [];
        const items = keys.flatMap((key) => config.productsByUrlKey?.[key] ?? []);
        response = { status: 200, body: { data: { products: { items } } } };
      } else if (operation === 'HeaderMenu' && menu !== undefined) {
        await delay(menuDelayMs);
        response =
          menu === 'outage'
            ? { status: 503, body: { message: 'Service Unavailable' } }
            : { status: 200, body: { data: menu } };
      } else if (CART_OPERATIONS.has(operation)) {
        response = { status: 200, body: answerCart(operation, variables, carts) };
      } else if (operation === 'StoreConfig') {
        response =
          storeConfig === 'outage'
            ? { status: 503, body: { message: 'Service Unavailable' } }
            : { status: 200, body: { data: { storeConfig } } };
      } else if (operation === 'generateMagentoSku') {
        response = {
          status: 200,
          body: {
            data: { processSku: { status: 'success', message: 'queued', action: 'create' } },
          },
        };
      } else {
        response = {
          status: 400,
          body: { errors: [{ message: `Unknown operation ${operation}` }] },
        };
      }
      return { call, ...response };
    });
  });

  const chapi = createServer((req, res) => {
    void handle(req, res, nextSeq, async (body) => {
      const call = record('chapi', req.url ?? '', body, res);
      const scenario = config.chapi[`${String(body.store)}:${String(body.sku)}`];
      await delay(scenario?.delayMs ?? config.chapiDefaultDelayMs);
      return {
        call,
        status: scenario?.status ?? 200,
        body: scenario?.body ?? { vendor: body.store, status: 'ok', data: [] },
      };
    });
  });

  function record(
    service: RecordedCall['service'],
    operation: string,
    body: Record<string, unknown>,
    res: ServerResponse,
    authorization?: string,
  ) {
    const call: RecordedCall = {
      service,
      operation,
      body,
      receivedSeq: nextSeq(),
      ...(authorization ? { authorization } : {}),
    };
    // Stamped as the connection closes, so callers see it before any delay ends.
    res.once('close', () => {
      if (!res.writableFinished) call.abortedSeq = nextSeq();
    });
    calls.push(call);
    return call;
  }

  const [magentoPort, chapiPort] = await Promise.all([listen(magento), listen(chapi)]);
  return {
    magentoUrl: `http://127.0.0.1:${magentoPort}/graphql`,
    chapiUrl: `http://127.0.0.1:${chapiPort}`,
    calls,
    nextSeq,
    callsTo: (service, operation) =>
      calls.filter(
        (c) => c.service === service && (operation === undefined || c.operation === operation),
      ),
    setMenu: (next) => {
      menu = next;
    },
    setMenuDelay: (ms) => {
      menuDelayMs = ms;
    },
    setStoreConfig: (next) => {
      storeConfig = next;
    },
    carts,
    reset: () => {
      calls.length = 0;
      carts.clear();
    },
    close: async () => {
      await Promise.all([close(magento), close(chapi)]);
    },
  };
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  nextSeq: () => number,
  respond: (
    body: Record<string, unknown>,
  ) => Promise<{ call: RecordedCall; status: number; body: unknown }>,
): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  } catch {
    // Recorded with an empty body.
  }
  const result = await respond(body);
  if (res.destroyed) return; // The client gave up (timeout); see `abortedSeq`.
  res.writeHead(result.status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result.body), () => {
    result.call.respondedSeq = nextSeq();
  });
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}

function close(server: Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One page of a category's products as Magento answers it: zero pages for an
 * empty category, and Magento's GraphQL input error for a page beyond the
 * last one of a non-empty category.
 */
function answerCategoryProducts(
  items: readonly Record<string, unknown>[],
  currentPage: number,
  pageSize: number,
): { status: number; body: unknown } {
  const totalPages = Math.ceil(items.length / pageSize);
  if (items.length > 0 && currentPage > totalPages) {
    return {
      status: 200,
      body: {
        errors: [
          {
            message: `currentPage value ${currentPage} specified is greater than the ${totalPages} page(s) available.`,
            extensions: { category: 'graphql-input' },
          },
        ],
        data: { products: null },
      },
    };
  }
  const start = (currentPage - 1) * pageSize;
  return {
    status: 200,
    body: {
      data: {
        products: {
          total_count: items.length,
          page_info: { current_page: currentPage, page_size: pageSize, total_pages: totalPages },
          items: items.slice(start, start + pageSize),
        },
      },
    },
  };
}

const CART_OPERATIONS = new Set([
  'createCart',
  'AddProductToCart',
  'getItemCount',
  'MiniCartQuery',
]);

/**
 * Minimal Magento cart for the storefront's cart operations: masked ids of 32
 * characters, unknown ids answer Magento's "Could not find a cart" error.
 */
function answerCart(
  operation: string,
  variables: Record<string, unknown>,
  carts: Map<string, MockCartItem[]>,
): unknown {
  if (operation === 'createCart') {
    const cartId = `mockcart${String(carts.size + 1).padStart(24, '0')}`;
    carts.set(cartId, []);
    return { data: { cartId } };
  }
  const cartId = String(variables.cartId);
  const items = carts.get(cartId);
  if (!items) {
    return {
      errors: [{ message: `Could not find a cart with ID "${cartId}"` }],
      data: operation === 'AddProductToCart' ? { addProductsToCart: null } : { cart: null },
    };
  }
  if (operation === 'AddProductToCart') {
    const product = (variables.product ?? {}) as Record<string, unknown>;
    const sku = String(product.sku);
    const existing = items.find((item) => item.sku === sku);
    if (existing) existing.quantity += Number(product.quantity);
    else items.push({ sku, quantity: Number(product.quantity), vendor: String(product.vendor) });
  }
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  if (operation === 'AddProductToCart') {
    return {
      data: {
        addProductsToCart: { cart: { id: cartId, total_quantity: totalQuantity }, user_errors: [] },
      },
    };
  }
  if (operation === 'getItemCount') {
    return { data: { cart: { id: cartId, total_quantity: totalQuantity } } };
  }
  return {
    data: {
      cart: {
        id: cartId,
        total_quantity: totalQuantity,
        prices: { subtotal_excluding_tax: { currency: 'MXN', value: 100 * totalQuantity } },
        items: items.map((item, index) => ({
          uid: `item-${index + 1}`,
          quantity: item.quantity,
          product: {
            uid: `product-${index + 1}`,
            name: `Producto ${item.sku}`,
            sku: item.sku,
            url_key: `${item.vendor}-${item.sku}-producto`,
            thumbnail: null,
            stock_status: 'IN_STOCK',
          },
          prices: { price: { currency: 'MXN', value: 100 } },
        })),
      },
    },
  };
}
