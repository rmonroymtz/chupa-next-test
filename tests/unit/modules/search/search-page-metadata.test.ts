import { describe, expect, it } from 'vitest';
import { buildSearchPageMetadata } from '@/modules/search/ui/search-page-metadata';

describe('buildSearchPageMetadata', () => {
  it('titles the page with the trimmed query and never lets it be indexed', () => {
    expect(buildSearchPageMetadata('  taladro inalámbrico ')).toEqual({
      title: 'Búsqueda: taladro inalámbrico',
      robots: { index: false, follow: true },
    });
  });

  it('uses a plain title for an empty query', () => {
    expect(buildSearchPageMetadata('   ')).toEqual({
      title: 'Búsqueda',
      robots: { index: false, follow: true },
    });
  });
});
