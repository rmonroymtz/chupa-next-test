import { z } from 'zod';
import type { ScraperResult } from '@/modules/product/application/ports';
import type {
  Availability,
  ScrapedPrice,
  ScrapedProduct,
  ScrapedVariants,
} from '@/modules/product/domain/product';

/**
 * zod schemas for the scraper API (CHAPI) payloads, following its OpenAPI
 * document. Only the fields the storefront reads are validated; unknown
 * fields are ignored.
 *
 * Product payloads are only rejected for core fields: `asin`, `title`, and a
 * price whose amount is present but not a number (showing a wrong price is
 * worse than showing none). Every other field is optional and degrades to
 * its empty value when malformed, so one odd field never hides the product.
 */
const optionalString = z.string().nullish().catch(null);
const optionalBoolean = z.boolean().nullish().catch(null);

/**
 * Scraper `stock` as a quantity cap, like legacy `parseStock`
 * (product-full-details helpers): a number or numeric string that is finite
 * and >= 1, floored; anything else (missing, empty, non-numeric, zero,
 * negative, non-number types) is null, read as "no limit".
 */
function parseStock(raw: unknown): number | null {
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  if (typeof raw === 'string' && raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : null;
}

const productDataSchema = z.object({
  asin: z.string().min(1),
  title: z.string(),
  price: z.unknown().optional(),
  parent_product_id: optionalString,
  vendor: optionalString,
  brand: optionalString,
  description: optionalString,
  short_description: optionalString,
  main_image: optionalString,
  image: optionalString,
  thumbnails: z.array(z.unknown()).nullish().catch(null),
  stock: z.unknown().transform(parseStock),
  stock_status: optionalString,
  item_available: optionalBoolean,
  has_variants: optionalBoolean,
  delivery_to: optionalBoolean,
  status: optionalString,
  breadcrumbs: optionalString,
  categories: z.array(z.string()).nullish().catch(null),
});

const productEnvelopeSchema = z.object({
  vendor: z.string().nullish(),
  status: z.string().nullish(),
  data: z.unknown().optional(),
});

const variantsSchema = z.object({
  asin: z.string().nullish(),
  vendor: z.string().nullish(),
  status: z.string().nullish(),
  variants: z
    .array(
      z.object({
        dimension: z.string(),
        type: z.string(),
        options: z
          .array(
            z.object({
              title: z.string(),
              asin: z.string(),
              image: z.string().nullish(),
              selected: z.boolean().nullish(),
              available: z.boolean().nullish(),
            }),
          )
          .nullish(),
      }),
    )
    .nullish(),
});

type ProductData = z.infer<typeof productDataSchema>;

const INVALID: ScraperResult<never> = { status: 'error', reason: 'invalid_response' };
const NOT_FOUND: ScraperResult<never> = { status: 'not_found' };
const BREADCRUMB_SEPARATOR = '>';

/**
 * Parses `POST /api/v1/product/`. The API reports a missing product with an
 * empty `data` (its default is `[]`), so empty data is `not_found`.
 */
export function parseSearchProductResult(payload: unknown): ScraperResult<ScrapedProduct> {
  const envelope = productEnvelopeSchema.safeParse(payload);
  if (!envelope.success) return INVALID;

  const { data } = envelope.data;
  if (isEmpty(data)) return NOT_FOUND;

  const parsed = productDataSchema.safeParse(data);
  if (!parsed.success) return INVALID;
  const price = toPrice(parsed.data.price);
  if (price === INVALID_PRICE) return INVALID;
  return {
    status: 'found',
    product: toScrapedProduct(parsed.data, price, envelope.data.vendor),
  };
}

/** Parses `POST /api/v1/product/variants/`; a payload without asin is `not_found`. */
export function parseVariantsResult(payload: unknown): ScraperResult<ScrapedVariants> {
  const parsed = variantsSchema.safeParse(payload);
  if (!parsed.success) return INVALID;
  const { asin, vendor, variants } = parsed.data;
  if (!asin) return NOT_FOUND;

  return {
    status: 'found',
    product: {
      sku: asin,
      vendor: vendor ?? '',
      dimensions: (variants ?? []).map((variant) => ({
        dimension: variant.dimension,
        type: variant.type,
        options: (variant.options ?? []).map((option) => ({
          title: option.title,
          sku: option.asin,
          image: option.image || null,
          selected: option.selected ?? false,
          available: option.available ?? true,
        })),
      })),
    },
  };
}

function toScrapedProduct(
  data: ProductData,
  price: ScrapedPrice | null,
  envelopeVendor: string | null | undefined,
): ScrapedProduct {
  const images = [data.main_image, data.image, ...(data.thumbnails ?? []).map(thumbnailLink)]
    .map((url) => url?.trim() ?? '')
    .filter((url) => url !== '');

  return {
    sku: data.asin,
    parentSku: data.parent_product_id || null,
    vendor: data.vendor || envelopeVendor || '',
    title: data.title,
    brand: data.brand || null,
    descriptionHtml: data.description ?? '',
    shortDescription: data.short_description ?? '',
    images: [...new Set(images)],
    price,
    stock: data.stock ?? null,
    availability: toAvailability(data.stock_status),
    itemAvailable: data.item_available ?? true,
    hasVariants: data.has_variants ?? false,
    deliveryTo: data.delivery_to ?? false,
    condition: data.status || null,
    breadcrumbs: (data.breadcrumbs ?? '')
      .split(BREADCRUMB_SEPARATOR)
      .map((crumb) => crumb.trim())
      .filter((crumb) => crumb !== ''),
    categories: data.categories ?? [],
  };
}

const INVALID_PRICE = Symbol('invalid price');

/**
 * Copies the price as returned; zero or missing previous prices become null.
 * A payload without a recognizable price shape (`[]`, `{}`, no amount) has no
 * price; an amount that is present but not a number is {@link INVALID_PRICE}.
 */
function toPrice(raw: unknown): ScrapedPrice | null | typeof INVALID_PRICE {
  if (!isRecord(raw)) return null;
  if ('current_price' in raw) {
    return readPrice(raw.current_price, raw.currency, raw.before_price, null);
  }
  if ('usd_current_price' in raw) {
    return readPrice(raw.usd_current_price, raw.usd_currency, raw.usd_before_price, 'USD');
  }
  return null;
}

function readPrice(
  current: unknown,
  currency: unknown,
  before: unknown,
  defaultCurrency: string | null,
): ScrapedPrice | typeof INVALID_PRICE {
  if (typeof current !== 'number' || !Number.isFinite(current)) return INVALID_PRICE;
  return {
    current,
    currency: (typeof currency === 'string' && currency) || defaultCurrency,
    before: typeof before === 'number' && before !== 0 ? before : null,
  };
}

function thumbnailLink(thumbnail: unknown): string | null {
  return isRecord(thumbnail) && typeof thumbnail.link === 'string' ? thumbnail.link : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toAvailability(status: string | null | undefined): Availability {
  const normalized = status?.trim().toLowerCase();
  if (normalized === 'in_stock') return 'in_stock';
  if (normalized === 'out_of_stock') return 'out_of_stock';
  return 'unknown';
}

function isEmpty(data: unknown): boolean {
  if (data === undefined || data === null) return true;
  if (Array.isArray(data)) return true;
  return typeof data === 'object' && Object.keys(data).length === 0;
}
