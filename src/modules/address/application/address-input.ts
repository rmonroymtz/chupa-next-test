import { z } from 'zod';
import { signinTokenSchema } from '@/modules/cart/application/cart-input';

/**
 * Validation of what the browser sends to the address Server Actions. They are
 * public endpoints: shape and size are checked before Magento is reached;
 * required attributes and values stay with Magento.
 */

const text = z.string().max(255);
const customFields = z
  .object({
    custom_field_1: text.optional(),
    custom_field_2: text.optional(),
    custom_field_3: text.optional(),
    custom_field_4: text.optional(),
  })
  .strict();

const addressSchema = z.object({
  firstName: z.string().trim().min(1).max(255),
  middleName: text,
  lastName: z.string().trim().min(1).max(255),
  street: z.array(text).min(1).max(5),
  city: text,
  postcode: z.string().max(12),
  countryId: z.string().regex(/^[A-Z]{2}$/),
  region: z.object({ name: text, id: z.number().int().positive().nullable() }),
  // The legacy phone formatter allows 12 digits.
  telephone: z.string().regex(/^\d{0,12}$/),
  customFields,
});

export const addressIdInputSchema = z.number().int().positive();

export const listAddressesInputSchema = z.object({ token: signinTokenSchema });
export const saveAddressInputSchema = z.object({
  token: signinTokenSchema,
  address: addressSchema,
});
export const updateAddressInputSchema = z.object({
  token: signinTokenSchema,
  id: addressIdInputSchema,
  address: addressSchema,
});
export const deleteAddressInputSchema = z.object({
  token: signinTokenSchema,
  id: addressIdInputSchema,
});
export const regionsInputSchema = z.object({ countryCode: z.string().regex(/^[A-Z]{2}$/) });
export const postcodeInputSchema = z.object({ postalCode: z.string().regex(/^\d{5}$/) });
