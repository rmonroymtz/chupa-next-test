'use server';

import {
  createAccountInputSchema,
  passwordResetInputSchema,
  signInInputSchema,
  signOutInputSchema,
} from '@/modules/customer/application/customer-input';
import type {
  CreateAccountResult,
  SignInResult,
} from '@/modules/customer/application/customer-service';
import type { RecaptchaConfig } from '@/modules/customer/application/ports';
import { getCustomerService } from '@/modules/customer/infrastructure/customer.composition';
import { getLogger } from '@/shared/observability/logger';

/**
 * Customer Server Actions: the only way the browser reaches Magento for the
 * session (no `/api/*` route; that prefix belongs to the scraper API at the
 * edge). Emails, passwords and tokens are never logged. Nothing is cached.
 */

export async function signInAction(input: unknown): Promise<SignInResult> {
  const parsed = signInInputSchema.safeParse(input);
  if (!parsed.success) {
    warnInvalidInput('sign_in');
    return { status: 'failed' };
  }
  try {
    return await getCustomerService().signIn(parsed.data);
  } catch {
    return { status: 'failed' };
  }
}

export async function createAccountAction(input: unknown): Promise<CreateAccountResult> {
  const parsed = createAccountInputSchema.safeParse(input);
  if (!parsed.success) {
    warnInvalidInput('create_account');
    return { status: 'failed' };
  }
  try {
    return await getCustomerService().createAccount(parsed.data);
  } catch {
    return { status: 'failed' };
  }
}

export async function requestPasswordResetAction(
  input: unknown,
): Promise<{ status: 'sent' | 'failed' }> {
  const parsed = passwordResetInputSchema.safeParse(input);
  if (!parsed.success) {
    warnInvalidInput('password_reset');
    return { status: 'failed' };
  }
  try {
    return await getCustomerService().requestPasswordReset(parsed.data);
  } catch {
    return { status: 'failed' };
  }
}

export async function signOutAction(input: unknown): Promise<{ status: 'signed_out' }> {
  const parsed = signOutInputSchema.safeParse(input);
  if (!parsed.success) {
    warnInvalidInput('sign_out');
    return { status: 'signed_out' };
  }
  try {
    return await getCustomerService().signOut(parsed.data);
  } catch {
    return { status: 'signed_out' };
  }
}

/** Null when Magento has no reCAPTCHA config: the forms then work without it. */
export async function getRecaptchaConfigAction(): Promise<RecaptchaConfig | null> {
  try {
    return await getCustomerService().getRecaptchaConfig();
  } catch {
    return null;
  }
}

/** Logs only the action name: the rejected input may hold a password or token. */
function warnInvalidInput(action: string): void {
  try {
    getLogger().child({ component: 'customer' }).warn({ action }, 'invalid customer action input');
  } catch {
    // Logging is best effort.
  }
}
