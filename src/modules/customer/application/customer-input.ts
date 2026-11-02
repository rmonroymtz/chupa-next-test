import { z } from 'zod';
import { cartIdSchema, signinTokenSchema } from '@/modules/cart/application/cart-input';

/**
 * Validation of what the browser sends to the customer Server Actions. They
 * are public endpoints: shape and size are checked before Magento is reached.
 * Password strength and email uniqueness stay with Magento.
 */

const email = z.string().trim().min(1).max(254);
// Not trimmed: spaces can be part of a password.
const password = z.string().min(1).max(256);
const name = z.string().trim().min(1).max(255);
const recaptchaToken = z.string().min(1).max(4096).nullable();

export const signInInputSchema = z.object({
  email,
  password,
  guestCartId: cartIdSchema.nullable(),
  recaptchaToken,
});

export const createAccountInputSchema = z.object({
  email,
  firstName: name,
  lastName: name,
  password,
  isSubscribed: z.boolean(),
  recaptchaToken,
});

export const passwordResetInputSchema = z.object({ email, recaptchaToken });

export const signOutInputSchema = z.object({ token: signinTokenSchema.nullable() });

export const getCustomerInputSchema = z.object({ token: signinTokenSchema });
