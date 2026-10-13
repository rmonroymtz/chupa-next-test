import type { NextConfig } from 'next';
import { parseImageRemoteHosts, toNextRemotePatterns } from './src/shared/config/image-hosts';
import { parseServerActionsAllowedOrigins } from './src/shared/config/server-actions';

// Build-time: `images.remotePatterns` is fixed when Next builds.
const imageRemotePatterns = parseImageRemoteHosts(process.env.IMAGE_REMOTE_HOSTS);
// Build-time: extra origins for the Server Action CSRF check (empty = same origin only).
const serverActionsAllowedOrigins = parseServerActionsAllowedOrigins(
  process.env.SERVER_ACTIONS_ALLOWED_ORIGINS,
);

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
  // Behind a proxy, Next accepts an action when the browser Origin host equals
  // X-Forwarded-Host (else Host); these hosts are accepted in addition.
  experimental: {
    serverActions: { allowedOrigins: serverActionsAllowedOrigins },
  },
};

export default nextConfig;
