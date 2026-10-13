import { SEARCH_PATH, SITE_LANGUAGE, SITE_NAME, siteRootUrl } from '@/modules/seo/domain/site';

export interface OrganizationConfig {
  readonly baseUrl: string;
  readonly logoUrl: string | null;
  /** Official social profiles. */
  readonly sameAs: readonly string[];
}

export interface OrganizationJsonLd {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'Organization';
  readonly '@id': string;
  readonly name: string;
  readonly url: string;
  readonly logo?: string;
  readonly sameAs?: readonly string[];
}

export interface WebSiteJsonLd {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'WebSite';
  readonly '@id': string;
  readonly name: string;
  readonly url: string;
  readonly inLanguage: string;
  readonly publisher: { readonly '@id': string };
  readonly potentialAction: {
    readonly '@type': 'SearchAction';
    readonly target: { readonly '@type': 'EntryPoint'; readonly urlTemplate: string };
    readonly 'query-input': string;
  };
}

const organizationId = (baseUrl: string) => `${siteRootUrl(baseUrl)}#organization`;

export function buildOrganizationJsonLd(config: OrganizationConfig): OrganizationJsonLd {
  const url = siteRootUrl(config.baseUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': organizationId(config.baseUrl),
    name: SITE_NAME,
    url,
    ...(config.logoUrl ? { logo: config.logoUrl } : {}),
    ...(config.sameAs.length > 0 ? { sameAs: [...config.sameAs] } : {}),
  };
}

/** WebSite with the legacy search page as its search action. */
export function buildWebSiteJsonLd({ baseUrl }: { readonly baseUrl: string }): WebSiteJsonLd {
  const url = siteRootUrl(baseUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${url}#website`,
    name: SITE_NAME,
    url,
    inLanguage: SITE_LANGUAGE,
    publisher: { '@id': organizationId(baseUrl) },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        // Built by hand: URLSearchParams would encode the `{}` placeholder.
        urlTemplate: `${url}${SEARCH_PATH.slice(1)}?query={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
