import type { MagentoProductLookup } from '@/modules/product/application/ports';
import type {
  Availability,
  CategoryLink,
  ConfigurableOption,
  MagentoPrice,
  Money,
  ProductCategory,
  ProductImage,
  ProductVariant,
  RelatedProduct,
} from '@/modules/product/domain/product';
import { DEFAULT_PRODUCT_URL_SUFFIX } from '@/modules/product/domain/product-url';

type Nullable<T> = T | null | undefined;

interface MoneyDto {
  value?: Nullable<number>;
  currency?: Nullable<string>;
}

interface PriceDto {
  final_price?: Nullable<MoneyDto>;
  regular_price?: Nullable<MoneyDto>;
  discount?: Nullable<{ amount_off?: Nullable<number>; percent_off?: Nullable<number> }>;
}

interface PriceRangeDto {
  minimum_price?: Nullable<PriceDto>;
}

/** Shape selected by PRODUCT_BY_ROUTE_QUERY (all fields optional for safety). */
export interface ProductRouteDto {
  __typename?: Nullable<string>;
  type?: Nullable<string>;
  redirect_code?: Nullable<number>;
  relative_url?: Nullable<string>;
  uid?: Nullable<string>;
  sku?: Nullable<string>;
  name?: Nullable<string>;
  url_key?: Nullable<string>;
  url_suffix?: Nullable<string>;
  description?: Nullable<{ html?: Nullable<string> }>;
  short_description?: Nullable<{ html?: Nullable<string> }>;
  meta_title?: Nullable<string>;
  meta_description?: Nullable<{ html?: Nullable<string> }>;
  media_gallery?: Nullable<
    Nullable<{
      url?: Nullable<string>;
      label?: Nullable<string>;
      position?: Nullable<number>;
      disabled?: Nullable<boolean>;
    }>[]
  >;
  price_range?: Nullable<PriceRangeDto>;
  stock_status?: Nullable<string>;
  categories?: Nullable<
    Nullable<{
      uid?: Nullable<string>;
      name?: Nullable<string>;
      url_path?: Nullable<string>;
      breadcrumbs?: Nullable<
        Nullable<{
          category_uid?: Nullable<string>;
          category_name?: Nullable<string>;
          category_url_path?: Nullable<string>;
        }>[]
      >;
    }>[]
  >;
  delivery_to?: Nullable<boolean>;
  product_status?: Nullable<string>;
  brand?: Nullable<string>;
  related_products?: Nullable<
    Nullable<{
      uid?: Nullable<string>;
      sku?: Nullable<string>;
      name?: Nullable<string>;
      url_key?: Nullable<string>;
      url_suffix?: Nullable<string>;
      small_image?: Nullable<{ url?: Nullable<string>; label?: Nullable<string> }>;
      price_range?: Nullable<PriceRangeDto>;
    }>[]
  >;
  configurable_options?: Nullable<
    Nullable<{
      uid?: Nullable<string>;
      attribute_code?: Nullable<string>;
      label?: Nullable<string>;
      position?: Nullable<number>;
      values?: Nullable<
        Nullable<{
          uid?: Nullable<string>;
          label?: Nullable<string>;
          value_index?: Nullable<number>;
        }>[]
      >;
    }>[]
  >;
  variants?: Nullable<
    Nullable<{
      attributes?: Nullable<
        Nullable<{
          uid?: Nullable<string>;
          code?: Nullable<string>;
          label?: Nullable<string>;
          value_index?: Nullable<number>;
        }>[]
      >;
      product?: Nullable<{
        uid?: Nullable<string>;
        sku?: Nullable<string>;
        name?: Nullable<string>;
        stock_status?: Nullable<string>;
        price_range?: Nullable<PriceRangeDto>;
      }>;
    }>[]
  >;
}

/**
 * Maps a `route()` result selected with the PDP fields. Pure: a null route or
 * a non-product entity is `not_found`; a redirect code wins over the entity.
 */
export function mapProductRoute(
  route: Nullable<ProductRouteDto>,
  requestedUrl: string,
): MagentoProductLookup {
  if (!route) return { kind: 'not_found' };

  const relativeUrl = route.relative_url || requestedUrl;
  const code = route.redirect_code ?? 0;
  if (code > 0) return { kind: 'redirect', relativeUrl, code };
  if (route.type !== 'PRODUCT' || !route.uid || !route.sku) return { kind: 'not_found' };

  return {
    kind: 'product',
    product: {
      uid: route.uid,
      typename: route.__typename ?? 'ProductInterface',
      sku: route.sku,
      name: route.name ?? route.sku,
      urlKey: route.url_key ?? '',
      relativeUrl,
      descriptionHtml: route.description?.html ?? '',
      shortDescriptionHtml: route.short_description?.html ?? '',
      metaTitle: blankToNull(route.meta_title),
      metaDescription: blankToNull(route.meta_description?.html),
      images: mapGallery(route.media_gallery),
      price: mapPrice(route.price_range?.minimum_price),
      availability: mapAvailability(route.stock_status),
      categories: mapCategories(route.categories),
      deliveryTo: route.delivery_to ?? null,
      productStatus: blankToNull(route.product_status),
      brand: blankToNull(route.brand),
      configurableOptions: mapConfigurableOptions(route.configurable_options),
      variants: mapVariants(route.variants),
      related: mapRelated(route.related_products),
    },
  };
}

function mapMoney(dto: Nullable<MoneyDto>): Money | null {
  if (typeof dto?.value !== 'number' || !dto.currency) return null;
  return { amount: dto.value, currency: dto.currency };
}

function mapPrice(dto: Nullable<PriceDto>): MagentoPrice | null {
  const final = mapMoney(dto?.final_price);
  if (!final) return null;
  const discount = dto?.discount;
  return {
    final,
    regular: mapMoney(dto?.regular_price) ?? final,
    discount: discount
      ? { amountOff: discount.amount_off ?? 0, percentOff: discount.percent_off ?? 0 }
      : null,
  };
}

function mapAvailability(status: Nullable<string>): Availability {
  if (status === 'IN_STOCK') return 'in_stock';
  if (status === 'OUT_OF_STOCK') return 'out_of_stock';
  return 'unknown';
}

function mapGallery(gallery: ProductRouteDto['media_gallery']): ProductImage[] {
  return compact(gallery)
    .filter((entry) => !entry.disabled && entry.url)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((entry) => ({ url: entry.url as string, label: blankToNull(entry.label) }));
}

function mapCategories(categories: ProductRouteDto['categories']): ProductCategory[] {
  return compact(categories)
    .filter((category) => category.name)
    .map((category) => ({
      name: category.name as string,
      urlPath: category.url_path ?? null,
      breadcrumbs: compact(category.breadcrumbs)
        .filter((crumb) => crumb.category_name)
        .map((crumb): CategoryLink => ({
          name: crumb.category_name as string,
          urlPath: crumb.category_url_path ?? null,
        })),
    }));
}

function mapConfigurableOptions(
  options: ProductRouteDto['configurable_options'],
): ConfigurableOption[] {
  return compact(options)
    .filter((option) => option.uid && option.attribute_code)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((option) => ({
      uid: option.uid as string,
      attributeCode: option.attribute_code as string,
      label: option.label ?? option.attribute_code ?? '',
      values: compact(option.values)
        .filter((value) => typeof value.value_index === 'number')
        .map((value) => ({
          uid: value.uid ?? null,
          label: value.label ?? '',
          valueIndex: value.value_index as number,
        })),
    }));
}

function mapVariants(variants: ProductRouteDto['variants']): ProductVariant[] {
  return compact(variants).flatMap((variant) => {
    const product = variant.product;
    if (!product?.uid || !product.sku) return [];
    const final = mapMoney(product.price_range?.minimum_price?.final_price);
    return [
      {
        uid: product.uid,
        sku: product.sku,
        name: product.name ?? null,
        availability: mapAvailability(product.stock_status),
        price: final
          ? { final, regular: mapMoney(product.price_range?.minimum_price?.regular_price) ?? final }
          : null,
        attributes: compact(variant.attributes)
          .filter((attribute) => attribute.code && typeof attribute.value_index === 'number')
          .map((attribute) => ({
            code: attribute.code as string,
            label: attribute.label ?? '',
            valueIndex: attribute.value_index as number,
          })),
      },
    ];
  });
}

function mapRelated(related: ProductRouteDto['related_products']): RelatedProduct[] {
  return compact(related).flatMap((item) => {
    if (!item.uid || !item.sku || !item.name || !item.url_key) return [];
    return [
      {
        uid: item.uid,
        sku: item.sku,
        name: item.name,
        relativeUrl: `${item.url_key}${item.url_suffix ?? DEFAULT_PRODUCT_URL_SUFFIX}`,
        image: item.small_image?.url
          ? { url: item.small_image.url, label: blankToNull(item.small_image.label) }
          : null,
        price: mapMoney(item.price_range?.minimum_price?.final_price),
      },
    ];
  });
}

function compact<T>(items: Nullable<Nullable<T>[]>): T[] {
  return (items ?? []).filter((item): item is T => item !== null && item !== undefined);
}

function blankToNull(value: Nullable<string>): string | null {
  return value && value.trim() !== '' ? value : null;
}
