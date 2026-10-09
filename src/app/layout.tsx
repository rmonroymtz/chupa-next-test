import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

// Every route renders per request; the storefront uses no ISR or data cache.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Chupaprecios',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
