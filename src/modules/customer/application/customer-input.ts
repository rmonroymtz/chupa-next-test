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

/** Reset tokens are short alphanumeric strings (Magento sends 32 hex characters). */
const resetToken = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

export const resetPasswordInputSchema = z.object({
  email,
  token: resetToken,
  newPassword: password,
  recaptchaToken,
});

export const signOutInputSchema = z.object({ token: signinTokenSchema.nullable() });

export const getCustomerInputSchema = z.object({ token: signinTokenSchema });

/** Profile edit: any of the three groups, run in the legacy order (phone, identity, password). */
export const updateProfileInputSchema = z
  .object({
    token: signinTokenSchema,
    phone: z
      .string()
      .regex(/^\d{0,10}$/)
      .optional(),
    identity: z
      .object({
        firstName: name,
        lastName: name,
        email,
        // The current password: empty when the email does not change.
        password: z.string().max(256),
      })
      .optional(),
    password: z.object({ current: password, next: password }).optional(),
    recaptchaToken,
  })
  .refine((value) => value.phone !== undefined || value.identity || value.password, {
    message: 'Nothing to update',
  });
