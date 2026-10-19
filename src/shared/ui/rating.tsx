import { cx } from './class-names';

const STAR_PATH =
  'M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z';

/**
 * `card`: PWA Gallery `ReviewStars` (20px stars, 2px gap, #FDAA40 on #D1D5DB).
 * `slider`: PWA recommendation slider `Stars` (12px, 1px gap, #F59E0B on #D1D5DB).
 * #D1D5DB and #F59E0B have no identical DS token (ds-neutral-300 is #C7C7C7).
 */
const VARIANTS = {
  card: { size: 20, gap: 'gap-[2px]', empty: 'text-[#d1d5db]', filled: 'text-ds-amber' },
  slider: { size: 12, gap: 'gap-px', empty: 'text-[#d1d5db]', filled: 'text-[#f59e0b]' },
} as const;

interface RatingProps {
  /** Review rating 0–5 (fractions allowed); nothing renders for 0. */
  readonly value: number;
  readonly variant?: keyof typeof VARIANTS;
}

/**
 * Five grey stars with the amber ones clipped to the rating, so no per-card
 * SVG gradient ids are needed. Labelled as one image (the PWA slider label).
 */
export function Rating({ value, variant = 'card' }: RatingProps) {
  const rating = Math.min(value, 5);
  if (!(rating > 0)) return null;
  const look = VARIANTS[variant];
  return (
    <div
      role="img"
      aria-label={`Calificación: ${rating.toFixed(1)} de 5 estrellas`}
      className="relative inline-flex w-fit"
    >
      <Stars size={look.size} className={cx(look.gap, look.empty)} />
      <div
        data-rating-fill
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${Math.round((rating / 5) * 100)}%` }}
      >
        <Stars size={look.size} className={cx(look.gap, look.filled)} />
      </div>
    </div>
  );
}

function Stars({ size, className }: { readonly size: number; readonly className: string }) {
  return (
    <span className={cx('flex', className)} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} viewBox="0 0 20 20" width={size} height={size} className="shrink-0">
          <path fill="currentColor" d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}
