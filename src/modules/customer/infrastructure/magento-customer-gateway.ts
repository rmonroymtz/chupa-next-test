import 'server-only';
import {
  CustomerGatewayError,
  type Customer,
  type CustomerGateway,
  type CustomerGatewayErrorKind,
} from '@/modules/customer/application/ports';
import {
  GET_CUSTOMER_QUERY,
  MERGE_CARTS_MUTATION,
  SIGN_IN_MUTATION,
  SIGN_OUT_MUTATION,
} from '@/modules/customer/infrastructure/customer.queries';
import { MagentoRequestError, type MagentoClient } from '@/shared/graphql/client';

const INVALID_CREDENTIALS_MESSAGE = 'The account sign-in was incorrect';
const NOT_AUTHORIZED_MESSAGES = ["The current customer isn't authorized", 'not authorized'];

function classify(caught: unknown): CustomerGatewayErrorKind {
  if (!(caught instanceof MagentoRequestError) || caught.kind !== 'graphql') return 'failure';
  if (caught.graphqlMessages.some((message) => message.includes(INVALID_CREDENTIALS_MESSAGE))) {
    return 'invalid_credentials';
  }
  if (
    caught.graphqlMessages.some((message) =>
      NOT_AUTHORIZED_MESSAGES.some((fragment) => message.includes(fragment)),
    )
  ) {
    return 'not_authorized';
  }
  return 'failure';
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * Magento customer adapter. The password and the token only travel in the
 * request; the client logs no variables or headers, and errors here carry
 * only the operation name.
 */
export function createMagentoCustomerGateway(client: MagentoClient): CustomerGateway {
  async function call<TData>(
    operationName: string,
    query: string,
    variables: Record<string, unknown>,
    token: string | null,
  ): Promise<TData> {
    try {
      return await client.request<TData>({
        operationName,
        query,
        variables,
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      });
    } catch (caught) {
      throw new CustomerGatewayError(classify(caught), `Magento ${operationName} failed`, {
        cause: caught,
      });
    }
  }

  return {
    async signIn(email, password) {
      const data = await call<{ generateCustomerToken: { token?: unknown } | null } | null>(
        'SignIn',
        SIGN_IN_MUTATION,
        { email, password },
        null,
      );
      const token = data?.generateCustomerToken?.token;
      if (typeof token !== 'string' || token === '') {
        throw new CustomerGatewayError('failure', 'Magento SignIn returned no token');
      }
      return token;
    },

    async getCustomer(token) {
      const data = await call<{ customer: Record<string, unknown> | null } | null>(
        'GetCustomerAfterSignIn',
        GET_CUSTOMER_QUERY,
        {},
        token,
      );
      const customer = data?.customer;
      if (!customer) {
        throw new CustomerGatewayError(
          'failure',
          'Magento GetCustomerAfterSignIn returned no customer',
        );
      }
      return {
        email: asString(customer.email),
        firstName: asString(customer.firstname),
        lastName: asString(customer.lastname),
        isSubscribed: customer.is_subscribed === true,
      } satisfies Customer;
    },

    async mergeCarts(sourceCartId, destinationCartId, token) {
      const data = await call<{ mergeCarts: { id?: unknown } | null } | null>(
        'MergeCartsAfterSignIn',
        MERGE_CARTS_MUTATION,
        { sourceCartId, destinationCartId },
        token,
      );
      if (!data?.mergeCarts) {
        throw new CustomerGatewayError('failure', 'Magento MergeCartsAfterSignIn returned no cart');
      }
    },

    async revokeToken(token) {
      const data = await call<{ revokeCustomerToken: { result?: unknown } | null } | null>(
        'SignOutFromMenu',
        SIGN_OUT_MUTATION,
        {},
        token,
      );
      return data?.revokeCustomerToken?.result === true;
    },
  };
}
