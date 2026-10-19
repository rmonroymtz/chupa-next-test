import { z } from 'zod';

/**
 * Validation of what the browser sends to the cart Server Actions. Server
 * Actions are public endpoints, so every field is checked for shape and size
 * before it reaches Magento. Business rules (stock, salability, prices) stay
 * with Magento, which answers with `user_errors`.
 */

// Magento masked cart ids are 32 alphanumeric characters; leave some room.
const cartId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
// Magento customer tokens: opaque strings or JWTs.
const signinToken = z.string().regex(/^[A-Za-z0-9._~+/=-]{1,4096}$/);

const auth = { signinToken: signinToken.nullable() };

export const addToCartInputSchema = z.object({
  cartId: cartId.nullable(),
  ...auth,
  item: z.object({
    sku: z.string().trim().min(1).max(255),
    quantity: z.number().int().positive().max(1_000_000),
    vendor: z.string().max(64),
    selected_options: z.array(z.string().min(1).max(255)).min(1).max(50).optional(),
  }),
});

export const cartReadInputSchema = z.object({ cartId, ...auth });

// Magento cart item uids are base64 strings (`MTIzNDU=`).
const cartItemUid = z.string().regex(/^[A-Za-z0-9+/=_-]{1,256}$/);

export const removeCartItemInputSchema = z.object({ cartId, ...auth, itemUid: cartItemUid });

export type AddToCartInput = z.infer<typeof addToCartInputSchema>;
export type CartReadInput = z.infer<typeof cartReadInputSchema>;
export type RemoveCartItemInput = z.infer<typeof removeCartItemInputSchema>;
