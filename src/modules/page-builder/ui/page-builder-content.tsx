import 'server-only';
import {
  getPageBuilderLoader,
  getPageBuilderLogger,
} from '@/modules/page-builder/infrastructure/page-builder.composition';
import { renderPageBuilder } from '@/modules/page-builder/ui/render';

interface PageBuilderContentProps {
  /** Page Builder storage HTML (or plain HTML) from Magento. */
  readonly content: string;
  /** Identifies the page in logs, e.g. `cms:aviso-privacidad`. */
  readonly source: string;
}

/**
 * Server Component that renders Magento CMS content. Parsing, product lookups
 * and rendering all happen on the server; failures degrade the content and
 * are logged, never thrown.
 */
export async function PageBuilderContent({ content, source }: PageBuilderContentProps) {
  const view = await getPageBuilderLoader().load(content, source);
  return renderPageBuilder(view, { source, logger: getPageBuilderLogger() });
}
