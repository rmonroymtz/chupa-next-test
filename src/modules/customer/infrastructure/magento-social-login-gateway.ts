import 'server-only';
import {
  CustomerGatewayError,
  type LinkedSocialAccount,
  type SocialLoginButton,
  type SocialLoginGateway,
} from '@/modules/customer/application/ports';
import {
  SOCIAL_LOGIN_ACCOUNT_DATA_QUERY,
  SOCIAL_LOGIN_CONFIG_QUERY,
} from '@/modules/customer/infrastructure/customer.queries';
import { classify } from '@/modules/customer/infrastructure/magento-customer-gateway';
import type { MagentoClient } from '@/shared/graphql/client';

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Only http(s) urls: the browser opens this url in a popup. */
function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

function toButton(raw: unknown): SocialLoginButton | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const type = asString(record.type);
  const url = asString(record.url);
  if (type === '' || !isHttpUrl(url)) return null;
  return { type, label: asString(record.label) || type, url };
}

/** Magento Amasty social login adapter. The token only travels in the `Authorization` header. */
export function createMagentoSocialLoginGateway(client: MagentoClient): SocialLoginGateway {
  return {
    async getConfig() {
      try {
        const data = await client.request<{
          storeConfig: Record<string, unknown> | null;
          amSocialLoginButtonConfig: unknown;
        } | null>({
          operationName: 'SocialLoginConfig',
          query: SOCIAL_LOGIN_CONFIG_QUERY,
          variables: {},
        });
        if (!data?.storeConfig) return null;
        const buttons = Array.isArray(data.amSocialLoginButtonConfig)
          ? data.amSocialLoginButtonConfig
              .map(toButton)
              .filter((button): button is SocialLoginButton => button !== null)
          : [];
        return {
          enabled: data.storeConfig.amsociallogin_general_enabled === true,
          positions: asString(data.storeConfig.amsociallogin_general_login_position)
            .split(',')
            .map((position) => position.trim())
            .filter((position) => position !== ''),
          buttons,
        };
      } catch {
        return null;
      }
    },

    async getLinkedAccounts(token) {
      let data: { amSocialLoginAccountData: unknown } | null;
      try {
        data = await client.request<{ amSocialLoginAccountData: unknown } | null>({
          operationName: 'SocialLoginAccountData',
          query: SOCIAL_LOGIN_ACCOUNT_DATA_QUERY,
          variables: {},
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (caught) {
        throw new CustomerGatewayError(classify(caught), 'Magento SocialLoginAccountData failed', {
          cause: caught,
        });
      }
      const list = data?.amSocialLoginAccountData;
      if (!Array.isArray(list)) return [];
      return list.flatMap((raw): LinkedSocialAccount[] => {
        if (!raw || typeof raw !== 'object') return [];
        const record = raw as Record<string, unknown>;
        const type = asString(record.type);
        if (type === '') return [];
        return [{ type, name: asString(record.name) || type }];
      });
    },
  };
}
