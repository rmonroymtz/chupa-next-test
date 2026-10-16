import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AnalyticsProvider } from '@/modules/analytics/ui/analytics-provider.client';
import { GtmScript } from '@/modules/analytics/ui/gtm-script';
import { fontVariables } from '@/modules/layout/ui/fonts';
import { SiteFooter } from '@/modules/layout/ui/site-footer';
import { SiteHeaderContainer } from '@/modules/layout/ui/site-header.container';
import { OG_LOCALE, SITE_NAME } from '@/modules/seo/domain/site';
import {
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from '@/modules/seo/domain/site-structured-data';
import { getSiteConfig } from '@/modules/seo/infrastructure/site-config';
import { JsonLd } from '@/modules/seo/ui/json-ld';
import './globals.css';

// Every route renders per request; the storefront uses no ISR or data cache.
export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return {
    // Runtime PUBLIC_BASE_URL resolves relative metadata urls (not the build env).
    metadataBase: new URL(`${getSiteConfig().baseUrl}/`),
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    openGraph: { siteName: SITE_NAME, locale: OG_LOCALE, type: 'website' },
  };
}

/** Skip-link target: the page's single `<main>` landmark, rendered here for every route. */
const MAIN_CONTENT_ID = 'main-content';

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const site = getSiteConfig();
  return (
    <html lang="es-MX" className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        {/* First in <body> so window.dataLayer exists before anything pushes to it. */}
        <GtmScript />
        <a
          href={`#${MAIN_CONTENT_ID}`}
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:shadow-md"
        >
          Saltar al contenido principal
        </a>
        {/* Site-wide structured data, rendered once per page. */}
        <JsonLd data={buildOrganizationJsonLd(site)} />
        <JsonLd data={buildWebSiteJsonLd(site)} />
        <AnalyticsProvider>
          <SiteHeaderContainer />
          {/* The only <main> landmark: pages render plain containers inside it. */}
          <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <SiteFooter />
        </AnalyticsProvider>
      </body>
    </html>
  );
}
