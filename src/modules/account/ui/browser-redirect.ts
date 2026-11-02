/**
 * Full-page navigation (`location.replace`): the target may be served by
 * another origin behind the edge (the sign-in screen can still be PWA Studio's),
 * so a client-side router push would not reach it.
 */
export function redirectBrowser(url: string): void {
  window.location.replace(url);
}
