import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import home from '../../../fixtures/page-builder/venia-new-home.json';
import type { ContentNode } from '@/modules/page-builder/domain/content-node';
import { parsePageBuilder } from '@/modules/page-builder/parser/parse-page-builder';
import { renderPageBuilder } from '@/modules/page-builder/ui/render';

/** Recorded Magento `cmsPage(identifier: "venia-new-home")` content. */
const CONTENT = home.data.cmsPage.content;

function shape(nodes: readonly ContentNode[]): unknown[] {
  return nodes.map((node) =>
    node.children.length > 0 ? { [node.type]: shape(node.children) } : node.type,
  );
}

describe('venia-new-home (recorded home page)', () => {
  it('parses every content type: a row with a 6-slide slider and a row with products', () => {
    const doc = parsePageBuilder(CONTENT);

    expect(doc.isPageBuilder).toBe(true);
    expect(doc.warnings).toEqual([]);
    expect(shape(doc.nodes)).toEqual([
      { row: [{ slider: Array.from({ length: 6 }, () => 'slide') }] },
      { row: ['products'] },
    ]);
    const products = doc.nodes[1]?.children[0];
    expect(products).toMatchObject({ type: 'products', appearance: 'carousel' });
  });

  it('renders the slider with its 6 slides, the first one active', () => {
    const logger = { error: vi.fn() };
    const html = renderToStaticMarkup(
      <>
        {renderPageBuilder(
          { document: parsePageBuilder(CONTENT), productsFor: () => [] },
          { source: 'test', logger },
        )}
      </>,
    );

    expect(html).toContain('aria-roledescription="carrusel"');
    expect(html.match(/aria-roledescription="diapositiva"/g)).toHaveLength(6);
    expect(html.match(/data-active="true"/g)).toHaveLength(1);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
