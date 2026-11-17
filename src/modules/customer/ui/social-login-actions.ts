'use server';

import {
  getCustomerInputSchema,
  socialSignInInputSchema,
} from '@/modules/customer/application/customer-input';
import type {
  LinkedAccountsResult,
  SocialSignInResult,
} from '@/modules/customer/application/social-login-service';
import { getSocialLoginService } from '@/modules/customer/infrastructure/customer.composition';
import { getLogger } from '@/shared/observability/logger';

/** Amasty social login Server Actions. Tokens are never logged. Nothing is cached. */

export async function completeSocialSignInAction(input: unknown): Promise<SocialSignInResult> {
  const parsed = socialSignInInputSchema.safeParse(input);
  if (!parsed.success) {
    warnInvalidInput('social_sign_in');
    return { status: 'failed' };
  }
  try {
    return await getSocialLoginService().completeSignIn(parsed.data);
  } catch {
    return { status: 'failed' };
  }
}

export async function getLinkedSocialAccountsAction(input: unknown): Promise<LinkedAccountsResult> {
  const parsed = getCustomerInputSchema.safeParse(input);
  if (!parsed.success) {
    warnInvalidInput('linked_social_accounts');
    return { status: 'failed' };
  }
  try {
    return await getSocialLoginService().getLinkedAccounts(parsed.data);
  } catch {
    return { status: 'failed' };
  }
}

/** Logs only the action name: the rejected input may hold a token. */
function warnInvalidInput(action: string): void {
  try {
    getLogger().child({ component: 'customer' }).warn({ action }, 'invalid customer action input');
  } catch {
    // Logging is best effort.
  }
}
