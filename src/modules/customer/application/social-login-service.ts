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
  type SocialLoginConfig,
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
  /** Clock for the config cache; `Date.now` by default. */
  readonly now?: () => number;
  /** How long a config read is reused; 5 minutes by default. */
  readonly configTtlMs?: number;
  /** How long a page waits for Magento's config before rendering without buttons; 1.5 s by default. */
  readonly configTimeoutMs?: number;
}

const DEFAULT_CONFIG_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CONFIG_TIMEOUT_MS = 1500;

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
  now = Date.now,
  configTtlMs = DEFAULT_CONFIG_TTL_MS,
  configTimeoutMs = DEFAULT_CONFIG_TIMEOUT_MS,
}: SocialLoginServiceDeps): SocialLoginService {
  const kindOf = (caught: unknown) =>
    caught instanceof CustomerGatewayError ? caught.kind : 'failure';

  // The Amasty config is store-wide and changes rarely: one read per ttl for the
  // whole process, shared by concurrent renders. A failed read keeps the last
  // good config; a slow one does not hold the sign-in page past `configTimeoutMs`.
  let cached: { config: SocialLoginConfig; readAt: number } | null = null;
  let inFlight: Promise<SocialLoginConfig | null> | null = null;

  function refreshConfig(): Promise<SocialLoginConfig | null> {
    inFlight ??= socialLoginGateway
      .getConfig()
      .then((config) => {
        if (config) cached = { config, readAt: now() };
        else logger.warn('social login config read failed');
        return config ?? cached?.config ?? null;
      })
      .catch(() => {
        logger.warn('social login config read failed');
        return cached?.config ?? null;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  async function readConfig(): Promise<SocialLoginConfig | null> {
    if (cached && now() - cached.readAt < configTtlMs) return cached.config;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), configTimeoutMs);
    });
    try {
      const config = await Promise.race([refreshConfig(), timeout]);
      return config ?? cached?.config ?? null;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async getButtons() {
      const config = await readConfig();
      if (!config?.enabled || !config.positions.includes(SIGN_IN_POSITION)) return [];
      return config.buttons;
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
