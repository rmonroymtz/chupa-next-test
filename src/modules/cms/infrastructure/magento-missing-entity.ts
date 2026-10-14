import { MagentoRequestError } from '@/shared/graphql/client';

// Magento answers a missing or disabled CMS page/block with a GraphQL error
// (e.g. `The CMS block with the "x" ID doesn't exist.`), not null data.
const MISSING_ENTITY = /does(?:n't| not) exist/i;

/** True only when every GraphQL error says the requested CMS entity does not exist. */
export function isMagentoMissingEntity(error: unknown): boolean {
  return (
    error instanceof MagentoRequestError &&
    error.kind === 'graphql' &&
    error.graphqlMessages.length > 0 &&
    error.graphqlMessages.every((message) => MISSING_ENTITY.test(message))
  );
}
