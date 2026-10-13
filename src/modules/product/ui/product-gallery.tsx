import Image from 'next/image';
import { isOptimizableImageUrl, parseImageRemoteHosts } from '@/shared/config/image-hosts';

// Inlined at build time by next.config.ts, so it matches `images.remotePatterns`.
const REMOTE_PATTERNS = parseImageRemoteHosts(process.env.IMAGE_REMOTE_HOSTS);
const MAX_THUMBNAILS = 6;

export interface GalleryImage {
  readonly url: string;
  readonly label: string | null;
}

interface ProductGalleryProps {
  readonly images: readonly GalleryImage[];
  readonly alt: string;
  /**
   * `preload` for images in the initial HTML (adds a preload link in the head);
   * `eager` for images streamed later, where a head link can no longer help.
   */
  readonly loadingStrategy: 'preload' | 'eager';
}

/**
 * Product images. The first image is the LCP element: it loads with high
 * priority and its box is reserved (aspect-square) to avoid layout shift.
 * Hosts outside `IMAGE_REMOTE_HOSTS` render unoptimized instead of failing.
 */
export function ProductGallery({ images, alt, loadingStrategy }: ProductGalleryProps) {
  const [main, ...rest] = images;
  if (!main) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-neutral-100 text-sm text-neutral-500">
        Imagen no disponible
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-white">
        <Image
          src={main.url}
          alt={main.label ?? alt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-contain"
          unoptimized={!isOptimizableImageUrl(main.url, REMOTE_PATTERNS)}
          {...(loadingStrategy === 'preload'
            ? { preload: true }
            : { loading: 'eager' as const, fetchPriority: 'high' as const })}
        />
      </div>
      {rest.length > 0 ? (
        <ul className="flex gap-2 overflow-x-auto" aria-label="Más imágenes">
          {rest.slice(0, MAX_THUMBNAILS).map((image) => (
            <li
              key={image.url}
              className="relative size-20 shrink-0 overflow-hidden rounded border border-neutral-200 bg-white"
            >
              <Image
                src={image.url}
                alt={image.label ?? alt}
                fill
                sizes="80px"
                className="object-contain"
                unoptimized={!isOptimizableImageUrl(image.url, REMOTE_PATTERNS)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
