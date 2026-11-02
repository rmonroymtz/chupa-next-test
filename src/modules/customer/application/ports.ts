export interface Customer {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly isSubscribed: boolean;
}

/**
 * The account pages' view of the customer (legacy `AccountInformationPageFragment`):
 * `middlename`, `social_profile_photo` and `phone_number` are fields the Chupaprecios
 * Magento adds to `Customer`.
 */
export interface CustomerProfile {
  readonly firstName: string;
  /** Empty when the customer has none. */
  readonly middleName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly photoUrl: string | null;
}

export interface ProfileIdentity {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly password: string;
}

export interface NewCustomer {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly password: string;
  readonly isSubscribed: boolean;
}

/** Magento `recaptchaV3Config`: which forms need a token and how to load the script. */
export interface RecaptchaConfig {
  readonly siteKey: string;
  readonly badgePosition: string;
  readonly languageCode: string | null;
  /** Magento form ids, e.g. `CUSTOMER_LOGIN`, `CUSTOMER_CREATE`, `CUSTOMER_FORGOT_PASSWORD`. */
  readonly forms: readonly string[];
}

export type CustomerGatewayErrorKind =
  | 'invalid_credentials'
  | 'not_authorized'
  | 'email_taken'
  | 'weak_password'
  | 'wrong_password'
  | 'failure';

/**
 * `invalid_credentials`: Magento rejected the email/password pair (also its
 * temporary lock). `not_authorized`: Magento no longer accepts the sign-in
 * token (expired or revoked before the 1 h client ttl). `email_taken` and
 * `weak_password` come from account creation and profile updates;
 * `wrong_password` is the current password Magento rejects on a profile update.
 */
export class CustomerGatewayError extends Error {
  override readonly name = 'CustomerGatewayError';
  constructor(
    readonly kind: CustomerGatewayErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/** Magento customer operations. Every method rejects with a {@link CustomerGatewayError}. */
export interface CustomerGateway {
  /**
   * `generateCustomerToken`: answers the sign-in token. `recaptchaToken` goes
   * in the `X-ReCaptcha` header when Magento has the form enabled.
   */
  signIn(email: string, password: string, recaptchaToken?: string | null): Promise<string>;
  createAccount(customer: NewCustomer, recaptchaToken?: string | null): Promise<void>;
  /** `requestPasswordResetEmail`. Magento answers true even for unknown emails. */
  requestPasswordReset(email: string, recaptchaToken?: string | null): Promise<void>;
  /** Null when Magento has no reCAPTCHA v3 config or it cannot be read: forms then work without it. */
  getRecaptchaConfig(): Promise<RecaptchaConfig | null>;
  getCustomer(token: string): Promise<Customer>;
  /** `GetCustomerInformation`: what the account pages show. */
  getProfile(token: string): Promise<CustomerProfile>;
  /** `updateCustomer(input:{phone_number})`. */
  updatePhone(token: string, phone: string): Promise<void>;
  /**
   * `updateCustomer(input:{email,firstname,lastname,password})`: Magento needs the
   * current password to change the email, so it is always sent (empty when not needed).
   */
  updateIdentity(token: string, identity: ProfileIdentity): Promise<void>;
  /** `changeCustomerPassword`; `recaptchaToken` goes in `X-ReCaptcha` (form `CUSTOMER_EDIT`). */
  changePassword(
    token: string,
    currentPassword: string,
    newPassword: string,
    recaptchaToken: string | null,
  ): Promise<void>;
  /** Moves the guest cart items into the customer's cart (`mergeCarts`). */
  mergeCarts(sourceCartId: string, destinationCartId: string, token: string): Promise<void>;
  /** `revokeCustomerToken`: whether Magento revoked it. */
  revokeToken(token: string): Promise<boolean>;
}
