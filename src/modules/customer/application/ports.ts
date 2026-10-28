export interface Customer {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly isSubscribed: boolean;
}

export type CustomerGatewayErrorKind = 'invalid_credentials' | 'not_authorized' | 'failure';

/**
 * `invalid_credentials`: Magento rejected the email/password pair (also its
 * temporary lock). `not_authorized`: Magento no longer accepts the sign-in
 * token (expired or revoked before the 1 h client ttl).
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
  /** `generateCustomerToken`: answers the sign-in token. */
  signIn(email: string, password: string): Promise<string>;
  getCustomer(token: string): Promise<Customer>;
  /** Moves the guest cart items into the customer's cart (`mergeCarts`). */
  mergeCarts(sourceCartId: string, destinationCartId: string, token: string): Promise<void>;
  /** `revokeCustomerToken`: whether Magento revoked it. */
  revokeToken(token: string): Promise<boolean>;
}
