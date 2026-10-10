import { serializeJsonLd } from '@/modules/seo/domain/json-ld';

interface JsonLdProps {
  readonly data: object;
}

/** Server-rendered structured data block; the payload is escaped by `serializeJsonLd`. */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
