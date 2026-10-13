import type { NextConfig } from 'next';
import { parseImageRemoteHosts, toNextRemotePatterns } from './src/shared/config/image-hosts';

// Build-time: `images.remotePatterns` is fixed when Next builds.
const imageRemotePatterns = parseImageRemoteHosts(process.env.IMAGE_REMOTE_HOSTS);

// Every route is rendered dynamically: no ISR, no Cache Components, no data cache.
const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // Resolve metadata before streaming for every user agent, so robots and
  // canonical are always in the initial <head> (identical for bots and users).
  htmlLimitedBots: /.*/,
  // Inlined so the UI decides `unoptimized` with the same list the optimizer uses.
  env: {
    IMAGE_REMOTE_HOSTS: imageRemotePatterns.map((p) => `${p.hostname}${p.pathname}`).join(','),
  },
  images: {
    remotePatterns: toNextRemotePatterns(imageRemotePatterns),
  },
};

export default nextConfig;
