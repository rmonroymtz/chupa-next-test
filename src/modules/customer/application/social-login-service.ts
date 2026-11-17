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
  /** After a failed read with no config known, how long pages render without buttons before trying again; 30 s by default. */
  readonly configRetryMs?: number;
}

const DEFAULT_CONFIG_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CONFIG_TIMEOUT_MS = 1500;
const DEFAULT_CONFIG_RETRY_MS = 30 * 1000;

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
  configRetryMs = DEFAULT_CONFIG_RETRY_MS,
}: SocialLoginServiceDeps): SocialLoginService {
  const kindOf = (caught: unknown) =>
    caught instanceof CustomerGatewayError ? caught.kind : 'failure';

  // The Amasty config is store-wide and changes rarely: one read per ttl for the
  // whole process, shared by concurrent renders. Once a config is known, an
  // expired one is served while a background read refreshes it, and a failed
  // read keeps it. Only the first read waits, at most `configTimeoutMs`; if it
  // fails, pages render without buttons at once until `configRetryMs` passes.
  let cached: { config: SocialLoginConfig; readAt: number } | null = null;
  let failedAt: number | null = null;
  let inFlight: Promise<SocialLoginConfig | null> | null = null;

  function readFailed(): SocialLoginConfig | null {
    logger.warn('social login config read failed');
    if (!cached) failedAt = now();
    return cached?.config ?? null;
  }

  function refreshConfig(): Promise<SocialLoginConfig | null> {
    inFlight ??= socialLoginGateway
      .getConfig()
      .then((config) => {
        if (!config) return readFailed();
        cached = { config, readAt: now() };
        failedAt = null;
        return config;
      })
      .catch(readFailed)
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  async function readConfig(): Promise<SocialLoginConfig | null> {
    if (cached) {
      // Expired: serve it now and refresh in the background, so no render waits on Magento.
      if (now() - cached.readAt >= configTtlMs) void refreshConfig();
      return cached.config;
    }
    if (failedAt !== null && now() - failedAt < configRetryMs) return null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), configTimeoutMs);
    });
    try {
      // No config yet: wait for the first read, at most the time budget.
      return await Promise.race([refreshConfig(), timeout]);
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
