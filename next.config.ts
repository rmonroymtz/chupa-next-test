import type { NextConfig } from 'next';

// Every route is rendered dynamically: no ISR, no Cache Components, no data cache.
const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
