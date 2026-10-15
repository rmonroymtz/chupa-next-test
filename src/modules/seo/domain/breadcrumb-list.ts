export interface BreadcrumbEntry {
  readonly name: string;
  /** Absolute url. */
  readonly item: string;
}

export interface BreadcrumbListJsonLd {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'BreadcrumbList';
  readonly itemListElement: readonly ({
    readonly '@type': 'ListItem';
    readonly position: number;
  } & BreadcrumbEntry)[];
}

/** schema.org `BreadcrumbList` from a trail ordered from the site root down. */
export function buildBreadcrumbListJsonLd(
  entries: readonly BreadcrumbEntry[],
): BreadcrumbListJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      ...entry,
    })),
  };
}
