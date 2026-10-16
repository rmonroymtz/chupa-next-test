import 'server-only';
import { getServerEnv } from '@/shared/config/env';

/** The GTM container id, or null when GTM is not configured (`GTM_ID` unset). */
export function getGtmContainerId(): string | null {
  return getServerEnv().GTM_ID ?? null;
}
