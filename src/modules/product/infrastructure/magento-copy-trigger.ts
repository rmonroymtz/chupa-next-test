import 'server-only';
import type { Logger } from 'pino';
import type { ProductCopyTrigger } from '@/modules/product/application/ports';
import { getServerEnv } from '@/shared/config/env';
import { getMagentoClient, MagentoRequestError, type MagentoClient } from '@/shared/graphql/client';
import { defaultObservability } from '@/shared/http/observability';
import type { MetricsEmitter } from '@/shared/observability/metrics';

export const PROCESS_SKU_MUTATION = /* GraphQL */ `
  mutation generateMagentoSku($sku: String!, $vendor: String!) {
    processSku(input: { sku: $sku, vendor: $vendor }) {
      status
      message
      action
    }
  }
`;

interface ProcessSkuData {
  processSku: { status: string; message: string; action: string } | null;
}

export interface MagentoCopyTriggerConfig {
  readonly client: MagentoClient;
  /** Timeout for the mutation, independent of the client default. */
  readonly timeoutMs: number;
  readonly logger: Logger;
  readonly metrics: MetricsEmitter;
}

/**
 * Fire-and-forget `processSku` mutation that makes Magento create its copy
 * of a vendor product. It never rejects: failures are logged and counted.
 * The status reported by Magento is logged as-is.
 */
export function createMagentoCopyTrigger(config: MagentoCopyTriggerConfig): ProductCopyTrigger {
  return {
    async trigger({ sku, vendor }) {
      config.metrics.emitMetric({
        name: 'CopyMutationTriggered',
        value: 1,
        dimensions: { Vendor: vendor },
      });
      try {
        const data = await config.client.request<ProcessSkuData, { sku: string; vendor: string }>({
          operationName: 'generateMagentoSku',
          query: PROCESS_SKU_MUTATION,
          variables: { sku, vendor },
          timeoutMs: config.timeoutMs,
        });
        config.logger.info(
          {
            sku,
            vendor,
            status: data.processSku?.status ?? null,
            message: data.processSku?.message ?? null,
            action: data.processSku?.action ?? null,
          },
          'copy mutation completed',
        );
      } catch (error) {
        const reason = error instanceof MagentoRequestError ? error.kind : 'unknown';
        config.metrics.emitMetric({
          name: 'CopyMutationFailed',
          value: 1,
          dimensions: { Vendor: vendor, Reason: reason },
        });
        config.logger.warn(
          { sku, vendor, reason, err: error instanceof Error ? error : undefined },
          'copy mutation failed',
        );
      }
    },
  };
}

let defaultTrigger: ProductCopyTrigger | undefined;

/** Process-wide trigger configured from the server environment. */
export function getMagentoCopyTrigger(): ProductCopyTrigger {
  defaultTrigger ??= createMagentoCopyTrigger({
    client: getMagentoClient(),
    timeoutMs: getServerEnv().COPY_MUTATION_TIMEOUT_MS,
    ...defaultObservability('copy-mutation'),
  });
  return defaultTrigger;
}
