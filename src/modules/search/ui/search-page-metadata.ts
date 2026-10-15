import type { Metadata } from 'next';

/**
 * Head metadata of every search page (users and bots alike): the query in
 * the title (the layout's template adds the site name) and `noindex, follow`
 * (decision 6). No canonical: the page is never indexed, and robots.txt
 * already disallows every `/search.html?…` url.
 */
export function buildSearchPageMetadata(query: string): Metadata {
  const term = query.trim();
  return {
    title: term ? `Búsqueda: ${term}` : 'Búsqueda',
    robots: { index: false, follow: true },
  };
}
