import { SITE_NAME } from '@/modules/seo/domain/site';

/** Separators an admin may have put before the site name in a Magento meta title. */
const SEPARATORS = '|\\-–—:';

/**
 * A Magento meta title without a trailing `<separator> <site name>`, because
 * the layout's title template already appends the site name. The site name
 * is matched case-insensitively and only as the last segment; it is kept
 * anywhere else in the title. Null when nothing is left, so the caller falls
 * back to its next option (the entity name).
 */
export function withoutSiteNameSuffix(
  title: string | null | undefined,
  siteName: string = SITE_NAME,
): string | null {
  const name = siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const suffix = new RegExp(`(?:^|\\s*[${SEPARATORS}])\\s*${name}\\s*$`, 'iu');
  let text = (title ?? '').trim();
  let previous: string;
  do {
    previous = text;
    text = text.replace(suffix, '').trim();
  } while (text && text !== previous);
  return text || null;
}
