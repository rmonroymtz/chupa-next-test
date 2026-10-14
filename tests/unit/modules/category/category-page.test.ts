import { describe, expect, it } from 'vitest';
import type {
  CategoryPageDeps,
  CategoryPageResolution,
} from '@/modules/category/application/category-page';
import { resolveCategoryPage } from '@/modules/category/application/category-page';
import type { CategoryProductsRepository } from '@/modules/category/application/ports';
import type { ProductCard } from '@/modules/product/domain/product';
import {
  FAKE_CATEGORY,
  FakeCategoryProductsRepository,
  FakeCategoryRepository,
} from '../../../support/fakes';

const UID = FAKE_CATEGORY.uid;
const CLEAN_URL = '/electronica/computacion/laptops.html';

const card = (index: number): ProductCard => ({
  uid: `uid-${index}`,
  sku: `ebay-${index}`,
  name: `Product ${index}`,
  urlKey: `ebay-${index}-product`,
  relativeUrl: `ebay-${index}-product.html`,
  image: null,
  price: null,
  availability: 'in_stock',
});

/** 26 products at 12 per page: 3 pages. */
const PRODUCTS = Array.from({ length: 26 }, (_, index) => card(index + 1));

function setup(
  options: {
    products?: readonly ProductCard[];
    categoryMissing?: boolean;
    categoryFails?: boolean;
    productsFail?: boolean;
    pageSizeFails?: boolean;
    productsRepository?: CategoryProductsRepository;
  } = {},
) {
  const categories = new FakeCategoryRepository(
    options.categoryMissing ? {} : { [UID]: FAKE_CATEGORY },
    new Set(options.categoryFails ? [UID] : []),
  );
  const products = new FakeCategoryProductsRepository(
    { [UID]: options.products ?? PRODUCTS },
    new Set(options.productsFail ? [UID] : []),
  );
  const pageSizeCalls: number[] = [];
  const deps: CategoryPageDeps = {
    categories,
    products: options.productsRepository ?? products,
    getPageSize: async () => {
      pageSizeCalls.push(1);
      if (options.pageSizeFails) throw new Error('store config down');
      return 12;
    },
  };
  const resolve = (search: string) => resolveCategoryPage({ uid: UID, search }, deps);
  return { resolve, categories, products, pageSizeCalls };
}

const redirectTo = (location: string): CategoryPageResolution => ({ kind: 'redirect', location });

describe('resolveCategoryPage', () => {
  it('renders the first page, indexable, with the clean url as canonical', async () => {
    const { resolve, products } = setup();

    const result = await resolve('');

    expect(result).toMatchObject({
      kind: 'page',
      category: FAKE_CATEGORY,
      indexable: true,
      canonicalPath: 'electronica/computacion/laptops.html',
      listing: { currentPage: 1, pageSize: 12, totalPages: 3, totalCount: 26 },
    });
    expect(products.calls).toEqual([{ categoryUid: UID, currentPage: 1, pageSize: 12 }]);
  });

  it('renders a requested page with the canonical still without the page', async () => {
    const { resolve, products } = setup();

    const result = await resolve('page=3&utm_source=x');

    expect(result).toMatchObject({
      kind: 'page',
      indexable: true,
      canonicalPath: 'electronica/computacion/laptops.html',
      listing: { currentPage: 3, totalPages: 3 },
    });
    expect(result.kind === 'page' && result.listing.items.map((item) => item.uid)).toEqual([
      'uid-25',
      'uid-26',
    ]);
    expect(products.calls).toEqual([{ categoryUid: UID, currentPage: 3, pageSize: 12 }]);
  });

  it('renders an explicit ?page=1 without redirecting', async () => {
    const { resolve } = setup();

    await expect(resolve('page=1')).resolves.toMatchObject({
      kind: 'page',
      canonicalPath: 'electronica/computacion/laptops.html',
      listing: { currentPage: 1 },
    });
  });

  it('renders an empty category as a page that must not be indexed', async () => {
    const { resolve } = setup({ products: [] });

    await expect(resolve('')).resolves.toMatchObject({
      kind: 'page',
      indexable: false,
      canonicalPath: 'electronica/computacion/laptops.html',
      listing: { items: [], totalCount: 0, totalPages: 0, currentPage: 1 },
    });
  });

  it('is not_found when Magento has no such category', async () => {
    const { resolve } = setup({ categoryMissing: true });
    await expect(resolve('')).resolves.toEqual({ kind: 'not_found' });
  });

  it('is not_found for a missing category even when the page or products are invalid', async () => {
    await expect(setup({ categoryMissing: true }).resolve('page=abc')).resolves.toEqual({
      kind: 'not_found',
    });
    await expect(
      setup({ categoryMissing: true, productsFail: true }).resolve('page=2'),
    ).resolves.toEqual({ kind: 'not_found' });
  });

  it.each(['page=abc', 'page=0', 'page=-1', 'page=1.5', 'page='])(
    'redirects %s to the clean category url without reading products',
    async (search) => {
      const { resolve, products, pageSizeCalls } = setup();

      await expect(resolve(search)).resolves.toEqual(redirectTo(CLEAN_URL));
      expect(products.calls).toEqual([]);
      expect(pageSizeCalls).toEqual([]);
    },
  );

  it('keeps the other query parameters, in order, when redirecting', async () => {
    const { resolve } = setup();

    await expect(resolve('utm_source=x&page=abc&color=red%20blue')).resolves.toEqual(
      redirectTo(`${CLEAN_URL}?utm_source=x&color=red+blue`),
    );
  });

  it('redirects a page beyond the last one when Magento rejects it', async () => {
    const { resolve } = setup();
    await expect(resolve('page=4')).resolves.toEqual(redirectTo(CLEAN_URL));
  });

  it('redirects a page beyond the last one when Magento answers it anyway', async () => {
    const { resolve } = setup({
      productsRepository: {
        findPage: async ({ currentPage, pageSize }) => ({
          kind: 'page',
          page: { items: [], currentPage, pageSize, totalPages: 3, totalCount: 26 },
        }),
      },
    });
    await expect(resolve('page=4&utm_source=x')).resolves.toEqual(
      redirectTo(`${CLEAN_URL}?utm_source=x`),
    );
  });

  it('rejects instead of redirecting to itself when Magento refuses the first page', async () => {
    const { resolve } = setup({
      productsRepository: { findPage: async () => ({ kind: 'out_of_range' }) },
    });
    await expect(resolve('')).rejects.toThrow(/first page/);
    await expect(resolve('page=1')).rejects.toThrow(/first page/);
  });

  it('redirects any page after the first of an empty category', async () => {
    const { resolve } = setup({ products: [] });
    await expect(resolve('page=2')).resolves.toEqual(redirectTo(CLEAN_URL));
  });

  it('rejects when Magento fails reading the category, so it is a 5xx and never a 404', async () => {
    await expect(setup({ categoryFails: true }).resolve('')).rejects.toMatchObject({
      kind: 'http',
    });
    await expect(setup({ categoryFails: true }).resolve('page=abc')).rejects.toMatchObject({
      kind: 'http',
    });
  });

  it('rejects when Magento fails reading the products of an existing category', async () => {
    await expect(setup({ productsFail: true }).resolve('page=2')).rejects.toMatchObject({
      kind: 'http',
    });
  });

  it('rejects when the page size cannot be read', async () => {
    await expect(setup({ pageSizeFails: true }).resolve('')).rejects.toThrow('store config down');
  });
});
