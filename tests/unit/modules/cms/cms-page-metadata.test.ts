import { describe, expect, it } from 'vitest';
import type { CmsPage } from '@/modules/cms/domain/cms-page';
import { buildCmsPageMetadata } from '@/modules/cms/ui/cms-page-metadata';

const page: CmsPage = {
  identifier: 'aviso-privacidad',
  urlKey: 'aviso-privacidad',
  relativeUrl: 'aviso-privacidad',
  title: 'Aviso de privacidad',
  contentHeading: null,
  content: '<p>x</p>',
  metaTitle: 'Aviso',
  metaDescription: '  Conoce   cómo tratamos tus datos.  ',
  metaKeywords: null,
  pageLayout: 'cms-full-width',
};

describe('buildCmsPageMetadata', () => {
  it('is indexable with canonical, title, description and Open Graph', () => {
    expect(buildCmsPageMetadata(page, 'https://chupaprecios.com.mx/aviso-privacidad')).toEqual({
      title: 'Aviso',
      description: 'Conoce cómo tratamos tus datos.',
      robots: { index: true, follow: true },
      alternates: { canonical: 'https://chupaprecios.com.mx/aviso-privacidad' },
      openGraph: {
        type: 'website',
        url: 'https://chupaprecios.com.mx/aviso-privacidad',
        title: 'Aviso',
        description: 'Conoce cómo tratamos tus datos.',
        siteName: 'Chupaprecios',
        locale: 'es_MX',
      },
    });
  });

  it('falls back to the page title and omits an empty description', () => {
    const metadata = buildCmsPageMetadata(
      { ...page, metaTitle: ' ', metaDescription: null },
      'https://x.test/a',
    );
    expect(metadata.title).toBe('Aviso de privacidad');
    expect(metadata).not.toHaveProperty('description');
  });

  it('strips a trailing site name from the meta title, also in Open Graph', () => {
    const metadata = buildCmsPageMetadata(
      { ...page, metaTitle: 'Aviso | Chupaprecios' },
      'https://x.test/a',
    );
    expect(metadata.title).toBe('Aviso');
    expect(metadata.openGraph?.title).toBe('Aviso');
  });

  it('falls back to the page title when the meta title is only the site name', () => {
    const metadata = buildCmsPageMetadata(
      { ...page, metaTitle: 'Chupaprecios' },
      'https://x.test/a',
    );
    expect(metadata.title).toBe('Aviso de privacidad');
  });

  it('declares keywords when the admin set them', () => {
    expect(
      buildCmsPageMetadata({ ...page, metaKeywords: 'envíos, México' }, 'https://x.test/a')
        .keywords,
    ).toBe('envíos, México');
  });
});
