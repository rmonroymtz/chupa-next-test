import type { Logger } from 'pino';
import type { CartGateway } from '@/modules/cart/application/ports';
import {
  CustomerGatewayError,
  type Customer,
  type CustomerGateway,
  type NewCustomer,
  type RecaptchaConfig,
} from '@/modules/customer/application/ports';
import type { MetricsEmitter } from '@/shared/observability/metrics';

export interface SignInCommand {
  readonly email: string;
  readonly password: string;
  /** Guest cart id from PWA storage, merged into the customer cart; null when there is none. */
  readonly guestCartId: string | null;
  /** `X-ReCaptcha` token, when Magento enabled the form. */
  readonly recaptchaToken: string | null;
}

export type SignInResult =
  | {
      readonly status: 'signed_in';
      /** The browser stores it (PWA format, ttl 3600 s). */
      readonly token: string;
      /** The customer's cart to store; null when it could not be created: the browser forgets its cart id. */
      readonly cartId: string | null;
      /** Null when Magento did not answer the customer read. */
      readonly customer: Customer | null;
    }
  | { readonly status: 'invalid_credentials' }
  | { readonly status: 'failed' };

export interface CreateAccountCommand extends NewCustomer {
  readonly recaptchaToken: string | null;
}

export type CreateAccountResult =
  | { readonly status: 'created' }
  | { readonly status: 'email_taken' }
  | { readonly status: 'weak_password' }
  | { readonly status: 'failed' };

export interface PasswordResetCommand {
  readonly email: string;
  readonly recaptchaToken: string | null;
}

export interface SignOutCommand {
  readonly token: string | null;
}

export interface CustomerService {
  signIn(command: SignInCommand): Promise<SignInResult>;
  /** Creates the account only; the browser then signs in (each Magento call needs its own reCAPTCHA token). */
  createAccount(command: CreateAccountCommand): Promise<CreateAccountResult>;
  requestPasswordReset(command: PasswordResetCommand): Promise<{ status: 'sent' | 'failed' }>;
  /** Peregrine `signOut`: revoking is best effort, the browser always clears its session. */
  signOut(command: SignOutCommand): Promise<{ status: 'signed_out' }>;
  getRecaptchaConfig(): Promise<RecaptchaConfig | null>;
}

export interface CustomerServiceDeps {
  readonly customerGateway: CustomerGateway;
  readonly cartGateway: CartGateway;
  readonly logger: Logger;
  readonly metrics: MetricsEmitter;
}

/**
 * Customer use cases behind the Server Actions. Emails, passwords, tokens and
 * cart ids are never logged. Sign-in follows peregrine `useSignIn`: token,
 * a new customer cart, merge of the guest cart. Unlike peregrine, a failed
 * merge or customer read does not abort the sign-in: the token is valid.
 */
export function createCustomerService({
  customerGateway,
  cartGateway,
  logger,
  metrics,
}: CustomerServiceDeps): CustomerService {
  const kindOf = (caught: unknown) =>
    caught instanceof CustomerGatewayError ? caught.kind : 'failure';

  async function signIn({
    email,
    password,
    guestCartId,
    recaptchaToken,
  }: SignInCommand): Promise<SignInResult> {
    let token: string;
    try {
      token = await customerGateway.signIn(email, password, recaptchaToken);
    } catch (caught) {
      const kind = kindOf(caught);
      metrics.emitMetric({ name: 'SignIn', value: 1, dimensions: { Outcome: kind } });
      logger.warn({ kind }, 'sign-in failed');
      return { status: kind === 'invalid_credentials' ? 'invalid_credentials' : 'failed' };
    }

    let degraded = false;
    let cartId: string | null = null;
    try {
      cartId = await cartGateway.createEmptyCart({ signinToken: token });
    } catch {
      degraded = true;
      logger.warn('customer cart creation failed after sign-in');
    }

    if (cartId && guestCartId) {
      try {
        await customerGateway.mergeCarts(guestCartId, cartId, token);
      } catch {
        degraded = true;
        logger.warn('guest cart merge failed after sign-in');
      }
    }

    let customer: Customer | null = null;
    try {
      customer = await customerGateway.getCustomer(token);
    } catch {
      logger.warn('customer read failed after sign-in');
    }

    // `degraded`: signed in, but the customer cart or the guest cart merge failed (guest items may be lost).
    metrics.emitMetric({
      name: 'SignIn',
      value: 1,
      dimensions: { Outcome: degraded ? 'degraded' : 'signed_in' },
    });
    return { status: 'signed_in', token, cartId, customer };
  }

  return {
    signIn,

    async createAccount({ recaptchaToken, ...customer }) {
      try {
        await customerGateway.createAccount(customer, recaptchaToken);
        metrics.emitMetric({ name: 'CreateAccount', value: 1, dimensions: { Outcome: 'created' } });
        return { status: 'created' };
      } catch (caught) {
        const kind = kindOf(caught);
        metrics.emitMetric({ name: 'CreateAccount', value: 1, dimensions: { Outcome: kind } });
        logger.warn({ kind }, 'account creation failed');
        if (kind === 'email_taken' || kind === 'weak_password') return { status: kind };
        return { status: 'failed' };
      }
    },

    async requestPasswordReset({ email, recaptchaToken }) {
      try {
        await customerGateway.requestPasswordReset(email, recaptchaToken);
        return { status: 'sent' };
      } catch {
        logger.warn('password reset request failed');
        return { status: 'failed' };
      }
    },

    async signOut({ token }) {
      if (token) {
        try {
          await customerGateway.revokeToken(token);
        } catch {
          logger.warn('token revocation failed on sign-out');
        }
      }
      return { status: 'signed_out' };
    },

    getRecaptchaConfig: () => customerGateway.getRecaptchaConfig(),
  };
}
