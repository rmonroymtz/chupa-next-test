export interface ProductRobots {
  readonly index: boolean;
  readonly follow: boolean;
}

export interface ProductIndexabilityInput {
  /** Whether Magento `route()` resolved the product. */
  readonly existsInMagento: boolean;
}

/**
 * Robots directives for a product page. The input deliberately has no visitor
 * or user-agent field: every visitor (human or bot) must receive the same
 * directives, otherwise the page would be cloaking.
 */
export function getProductRobots({ existsInMagento }: ProductIndexabilityInput): ProductRobots {
  return { index: existsInMagento, follow: true };
}
