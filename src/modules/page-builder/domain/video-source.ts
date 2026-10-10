import type { VideoSource } from '@/modules/page-builder/domain/content-node';

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
]);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);
const VIDEO_ID = /^[A-Za-z0-9_-]{1,64}$/;
const FILE_EXTENSION = /\.(mp4|webm|ogg|ogv|mov)$/i;

/**
 * Classifies a Page Builder video url. Only https YouTube, Vimeo or direct
 * video files are accepted; anything else is not embedded.
 */
export function parseVideoSource(url: string | null): VideoSource | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split('/').filter((segment) => segment !== '');

  if (YOUTUBE_HOSTS.has(host)) {
    const id =
      host === 'youtu.be'
        ? segments[0]
        : segments[0] === 'embed' || segments[0] === 'shorts'
          ? segments[1]
          : parsed.searchParams.get('v');
    return id && VIDEO_ID.test(id) ? { kind: 'youtube', id } : null;
  }
  if (VIMEO_HOSTS.has(host)) {
    const id = segments.find((segment) => /^\d+$/.test(segment));
    return id ? { kind: 'vimeo', id } : null;
  }
  return FILE_EXTENSION.test(parsed.pathname) ? { kind: 'file', url: parsed.toString() } : null;
}

/** Privacy-friendly embed url: youtube-nocookie and Vimeo with Do Not Track. */
export function toEmbedUrl(
  source: Extract<VideoSource, { kind: 'youtube' | 'vimeo' }>,
  options: { readonly autoplay: boolean; readonly muted: boolean },
): string {
  const params = new URLSearchParams();
  if (source.kind === 'vimeo') params.set('dnt', '1');
  if (options.autoplay) params.set('autoplay', '1');
  if (options.muted) params.set(source.kind === 'vimeo' ? 'muted' : 'mute', '1');
  const query = params.toString();
  const base =
    source.kind === 'youtube'
      ? `https://www.youtube-nocookie.com/embed/${source.id}`
      : `https://player.vimeo.com/video/${source.id}`;
  return query ? `${base}?${query}` : base;
}
