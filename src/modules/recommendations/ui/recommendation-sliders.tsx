import { Suspense, use } from 'react';
import { ProductCards } from '@/modules/page-builder/ui/product-cards';
import type {
  RecommendationType,
  RecommendedProduct,
} from '@/modules/recommendations/domain/recommendation';
import { ProductCarousel } from '@/modules/recommendations/ui/product-carousel.client';

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
 * Recommendation sliders (Server Component; the cards render on the server and
 * the PWA embla carousel, a small client island, only enhances them): the three
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
      <ProductCarousel itemCount={cards.length}>
        <ProductCards cards={cards} appearance="carousel" card="slider" showRating />
      </ProductCarousel>
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

/**
 * The PWA loading state: the same carousel with `itemsPerView` skeleton slides
 * (PWA `.skeleton`), so the page does not jump when the slider streams in.
 */
function SliderSkeleton({ title, accent }: { readonly title: string; readonly accent: string }) {
  return (
    <div data-recommendation-loading>
      <SliderTitle title={title} accent={accent} />
      <ProductCarousel itemCount={SKELETON_CARDS}>
        {/* The slider's slides (PWA `.slide`): 2 on phones, 3 from 640px, 5 from 1024px, 10px gap. */}
        <ul aria-hidden="true" className="m-0 flex list-none gap-[10px] p-0">
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <li
              key={index}
              data-recommendation-skeleton
              className="min-w-0 shrink-0 basis-[calc(50%-5px)] min-[640px]:basis-[calc(33.33%-7px)] min-[1024px]:basis-[calc(20%-8px)]"
            >
              <div className="h-full rounded-[10px] border-[0.5px] border-ds-border px-3 pt-[10px] pb-3">
                <div className={`mb-2 aspect-square rounded-xs ${SHIMMER}`} />
                <div className={`mb-2 h-[10px] w-4/5 rounded-[4px] ${SHIMMER}`} />
                <div className={`h-[10px] w-1/2 rounded-[4px] ${SHIMMER}`} />
              </div>
            </li>
          ))}
        </ul>
      </ProductCarousel>
    </div>
  );
}

const SHIMMER = 'animate-pulse bg-ds-surface-muted motion-reduce:animate-none';

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
