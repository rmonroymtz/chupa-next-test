/**
 * Extra origins whose Server Action requests Next accepts, read at build
 * time from `SERVER_ACTIONS_ALLOWED_ORIGINS` (comma-separated hosts, optional
 * `:port`, `*.` / `**.` wildcards for subdomains) because
 * `experimental.serverActions.allowedOrigins` is fixed when Next builds.
 *
 * Next compares the browser `Origin` host with `X-Forwarded-Host` (else
 * `Host`). Behind a proxy that forwards the public host, the list stays
 * empty; it is only needed when the proxy cannot. Must stay free of framework
 * and server-only imports: `next.config.ts` imports it.
 */
const HOST_PATTERN = /^(?:\*\*?\.)?(?:[a-z0-9-]+\.)*[a-z0-9-]+(?::\d{1,5})?$/;

export function parseServerActionsAllowedOrigins(raw: string | undefined): string[] {
  const entries = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .map((entry) =>
      entry
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, ''),
    );
  const invalid = entries.filter((entry) => !HOST_PATTERN.test(entry));
  if (invalid.length > 0) {
    const list = invalid.map((entry) => JSON.stringify(entry)).join(', ');
    throw new Error(
      `Invalid SERVER_ACTIONS_ALLOWED_ORIGINS entries (expected hosts such as www.example.com or *.example.com): ${list}`,
    );
  }
  return entries;
}
