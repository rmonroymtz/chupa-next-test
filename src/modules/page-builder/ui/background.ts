import { getImageProps } from 'next/image';
import type { CSSProperties } from 'react';
import type { BackgroundImages } from '@/modules/page-builder/domain/content-node';
import { isOptimizableImageUrl, parseImageRemoteHosts } from '@/shared/config/image-hosts';

const REMOTE_PATTERNS = parseImageRemoteHosts(process.env.IMAGE_REMOTE_HOSTS);

// Requested widths (both are Next default device sizes).
const DESKTOP_WIDTH = 1920;
const MOBILE_WIDTH = 828;

/**
 * CSS custom properties for a background image: desktop and mobile variants
 * are swapped by the `.bg` rule at the legacy 768px breakpoint, without
 * client JavaScript. Magento media goes through the Next image optimizer
 * (`getImageProps`), other hosts are used as they are.
 */
export function backgroundStyle(
  images: BackgroundImages,
  fallbackSrc: string | null = null,
): CSSProperties | null {
  const desktop = images.desktop ?? fallbackSrc;
  const mobile = images.mobile;
  if (!desktop && !mobile) return null;
  const style: Record<string, string> = {};
  if (desktop) style['--pb-bg-desktop'] = cssUrl(imageUrl(desktop, DESKTOP_WIDTH));
  if (mobile) style['--pb-bg-mobile'] = cssUrl(imageUrl(mobile, MOBILE_WIDTH));
  return style as CSSProperties;
}

/**
 * Single url worth preloading for a background (LCP candidate), or null when
 * the desktop and mobile variants differ: a preload cannot carry a media
 * query here, and preloading both would waste bandwidth.
 */
export function backgroundPreloadUrl(
  images: BackgroundImages,
  fallbackSrc: string | null = null,
): string | null {
  const desktop = images.desktop ?? fallbackSrc;
  if (images.mobile && desktop && images.mobile !== desktop) return null;
  const src = desktop ?? images.mobile;
  return src ? imageUrl(src, desktop ? DESKTOP_WIDTH : MOBILE_WIDTH) : null;
}

function imageUrl(src: string, width: number): string {
  if (!isOptimizableImageUrl(src, REMOTE_PATTERNS)) return src;
  const { props } = getImageProps({ src, alt: '', width, height: width });
  // srcSet is `url 1x, url 2x`; the 1x candidate matches the requested width.
  return props.srcSet?.split(', ')[0]?.split(' ')[0] ?? props.src;
}

function cssUrl(url: string): string {
  return `url("${url.replace(/["\\\n\r]/g, (char) => `\\${char.charCodeAt(0).toString(16)} `)}")`;
}
