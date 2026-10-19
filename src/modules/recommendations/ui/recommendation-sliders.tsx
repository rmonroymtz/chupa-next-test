import { Suspense, use } from 'react';
import { ProductCards } from '@/modules/page-builder/ui/product-cards';
import type {
  RecommendationType,
  RecommendedProduct,
} from '@/modules/recommendations/domain/recommendation';

/**
 * Products of one slider (the composition's `getRecommendations`). Called
 * during render; its promise streams. A rejection hides the slider.
 */
export type RecommendationsLoader = (
  type: RecommendationType,
) => Promise<readonly RecommendedProduct[]>;

/** Legacy titles (`Crossell`, `Upsell`, `Recomender`), in display order. */
const SLIDERS: readonly {
  readonly type: RecommendationType;
  readonly title: string;
  readonly accent: string;
}[] = [
  { type: 'tendency', title: 'Los productos en', accent: 'tendencia' },
  { type: 'also_bought', title: 'Otras personas', accent: 'también compraron' },
  { type: 'recently', title: 'Productos más buscados', accent: 'recientemente' },
];

/** Legacy `itemsPerView`: skeleton cards while a slider loads. */
const SKELETON_CARDS = 5;

interface RecommendationSlidersProps {
  readonly load: RecommendationsLoader;
}

/**
 * Recommendation sliders (Server Component, no client JavaScript): the three
 * loads start in the same render, so they run in parallel, and each slider
 * streams in its own Suspense boundary (title and skeleton cards meanwhile).
 * A slider without products, or whose load fails, renders nothing.
 */
export function RecommendationSliders({ load }: RecommendationSlidersProps) {
  return (
    <div data-recommendations className="mt-10 flex flex-col gap-8">
      {SLIDERS.map((slider) => (
        <Suspense key={slider.type} fallback={<SliderSkeleton {...slider} />}>
          <RecommendationSlider {...slider} products={safeLoad(load, slider.type)} />
        </Suspense>
      ))}
    </div>
  );
}

function RecommendationSlider({
  type,
  title,
  accent,
  products,
}: {
  readonly type: RecommendationType;
  readonly title: string;
  readonly accent: string;
  /** Must not reject. */
  readonly products: Promise<readonly RecommendedProduct[]>;
}) {
  const cards = use(products);
  if (cards.length === 0) return null;
  const headingId = `recommendation-${type}`;
  return (
    <section data-recommendation={type} aria-labelledby={headingId}>
      <SliderTitle id={headingId} title={title} accent={accent} />
      <ProductCards cards={cards} appearance="carousel" card="slider" showRating />
    </section>
  );
}

function SliderTitle({
  id,
  title,
  accent,
}: {
  readonly id?: string;
  readonly title: string;
  readonly accent: string;
}) {
  return (
    <h2 id={id} className="mb-4 text-responsive-title leading-tight font-bold">
      {title} <span className="text-ds-accent">{accent}</span>
    </h2>
  );
}

/** Same title and card boxes as the slider, so the page does not jump when it streams in. */
function SliderSkeleton({ title, accent }: { readonly title: string; readonly accent: string }) {
  return (
    <div data-recommendation-loading>
      <SliderTitle title={title} accent={accent} />
      {/* The carousel's columns: 2 on phones, 4 from 641px, 5 from 961px. */}
      <div
        aria-hidden="true"
        className="grid grid-cols-2 gap-4 min-[641px]:grid-cols-4 min-[961px]:grid-cols-5"
      >
        {Array.from({ length: SKELETON_CARDS }, (_, index) => (
          <div
            key={index}
            data-recommendation-skeleton
            className={`flex-col gap-2 ${skeletonVisibility(index)}`}
          >
            <div className="aspect-square animate-pulse rounded-xs bg-ds-surface-muted" />
            <div className="h-3 w-4/5 animate-pulse rounded-xs bg-ds-surface-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded-xs bg-ds-surface-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function skeletonVisibility(index: number): string {
  if (index < 2) return 'flex';
  return index < 4 ? 'hidden min-[641px]:flex' : 'hidden min-[961px]:flex';
}

/** A slider must never fail the page: any failure means no products. */
function safeLoad(
  load: RecommendationsLoader,
  type: RecommendationType,
): Promise<readonly RecommendedProduct[]> {
  try {
    return load(type).catch(() => []);
  } catch {
    return Promise.resolve([]);
  }
}
