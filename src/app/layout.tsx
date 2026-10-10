import type { Metadata } from 'next';
import type { ReactNode } from 'react';
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

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const site = getSiteConfig();
  return (
    <html lang="es-MX">
      <body>
        {/* Site-wide structured data, rendered once per page. */}
        <JsonLd data={buildOrganizationJsonLd(site)} />
        <JsonLd data={buildWebSiteJsonLd(site)} />
        {children}
      </body>
    </html>
  );
}
