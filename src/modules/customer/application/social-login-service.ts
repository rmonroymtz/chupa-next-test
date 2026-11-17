import type { Logger } from 'pino';
import type { CartGateway } from '@/modules/cart/application/ports';
import {
  openCustomerSession,
  type SignInResult,
} from '@/modules/customer/application/customer-service';
import {
  CustomerGatewayError,
  type Customer,
  type CustomerGateway,
  type LinkedSocialAccount,
  type SocialLoginButton,
  type SocialLoginGateway,
} from '@/modules/customer/application/ports';
import type { MetricsEmitter } from '@/shared/observability/metrics';

/** Amasty position of the sign-in and create-account forms (legacy `mode="popup"`). */
const SIGN_IN_POSITION = 'popup';

export interface SocialSignInCommand {
  /** The token the Amasty popup posted to the page. Checked with Magento before use. */
  readonly token: string;
  readonly guestCartId: string | null;
}

export type SocialSignInResult =
  Extract<SignInResult, { status: 'signed_in' }> | { readonly status: 'failed' };

export type LinkedAccountsResult =
  | { readonly status: 'ok'; readonly accounts: readonly LinkedSocialAccount[] }
  | { readonly status: 'not_authorized' }
  | { readonly status: 'failed' };

export interface SocialLoginService {
  /** Buttons for the sign-in and create-account forms; empty when Amasty does not offer them there. */
  getButtons(): Promise<readonly SocialLoginButton[]>;
  /** Opens the session for a token from the Amasty popup, like the password sign-in after its token. */
  completeSignIn(command: SocialSignInCommand): Promise<SocialSignInResult>;
  getLinkedAccounts(command: { readonly token: string }): Promise<LinkedAccountsResult>;
}

export interface SocialLoginServiceDeps {
  readonly customerGateway: CustomerGateway;
  readonly cartGateway: CartGateway;
  readonly socialLoginGateway: SocialLoginGateway;
  readonly logger: Logger;
  readonly metrics: MetricsEmitter;
}

/**
 * Amasty social login use cases. The browser sends the token the popup
 * posted; the service does not trust it until Magento answers the customer
 * read with it. Tokens are never logged.
 */
export function createSocialLoginService({
  customerGateway,
  cartGateway,
  socialLoginGateway,
  logger,
  metrics,
}: SocialLoginServiceDeps): SocialLoginService {
  const kindOf = (caught: unknown) =>
    caught instanceof CustomerGatewayError ? caught.kind : 'failure';

  return {
    async getButtons() {
      try {
        const config = await socialLoginGateway.getConfig();
        if (!config?.enabled || !config.positions.includes(SIGN_IN_POSITION)) return [];
        return config.buttons;
      } catch {
        logger.warn('social login config read failed');
        return [];
      }
    },

    async completeSignIn({ token, guestCartId }) {
      let customer: Customer;
      try {
        customer = await customerGateway.getCustomer(token);
      } catch (caught) {
        const kind = kindOf(caught);
        metrics.emitMetric({ name: 'SocialSignIn', value: 1, dimensions: { Outcome: kind } });
        logger.warn({ kind }, 'social sign-in token check failed');
        return { status: 'failed' };
      }

      const { cartId, degraded } = await openCustomerSession(
        { customerGateway, cartGateway, logger },
        token,
        guestCartId,
      );
      metrics.emitMetric({
        name: 'SocialSignIn',
        value: 1,
        dimensions: { Outcome: degraded ? 'degraded' : 'signed_in' },
      });
      return { status: 'signed_in', token, cartId, customer };
    },

    async getLinkedAccounts({ token }) {
      try {
        return { status: 'ok', accounts: await socialLoginGateway.getLinkedAccounts(token) };
      } catch (caught) {
        const kind = kindOf(caught);
        if (kind === 'not_authorized') return { status: 'not_authorized' };
        logger.warn({ kind }, 'linked social accounts read failed');
        return { status: 'failed' };
      }
    },
  };
}
