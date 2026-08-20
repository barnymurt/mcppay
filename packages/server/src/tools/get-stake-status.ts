import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Ledger as LedgerType } from '@mcp-pg/ledger';
import type { ServerConfig } from '../config.js';
import { getStakeStatus } from '@mcp-pg/ledger';
import { ErrorCode } from '@mcp-pg/types';

const DEFAULT_GERO_USD_RATE = 0.05;

export function registerGetStakeStatus(
  server: McpServer,
  ledger: LedgerType,
  _config: ServerConfig
): void {
  (server as any).registerTool(
    'get_stake_status',
    {
      description: 'Get the current staking status for an account, including tier, discounts, and progress to next tier.',
      inputSchema: {
        account_id: { type: 'string', description: 'Account ID to check stake status' },
      },
    },
    async (args: any) => {
      const { account_id } = args;

      if (!account_id) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ isError: true, error: { code: ErrorCode.VALIDATION_ERROR, message: 'account_id is required' } }),
          }],
        };
      }

      try {
        const result = getStakeStatus(ledger, account_id, DEFAULT_GERO_USD_RATE);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              account_id,
              staked: result.staked,
              staked_usd: result.stakedUsd.toFixed(2),
              tier: result.tier,
              next_tier_threshold: result.nextTierThreshold,
              usd_to_next_tier: result.usdToNextTier.toFixed(2),
              current_discount_percent: result.currentDiscountPercent,
              unstake_pending: result.unstakePending,
              unstake_available_at: result.unstakeAvailableAt,
              tier_names: ['Tier 0 (Base)', 'Tier 1', 'Tier 2', 'Tier 3 (Max)'],
              message: result.tier === 3
                ? 'You have max tier! Enjoy maximum fee discounts and unlimited access.'
                : result.usdToNextTier > 0
                  ? `Stake $${result.usdToNextTier.toFixed(2)} more USD equivalent to reach Tier ${result.tier + 1}`
                  : 'You qualify for the next tier!',
            }),
          }],
        };
      } catch (err: any) {
        const errorCode = err.message === 'ACCOUNT_NOT_FOUND' ? ErrorCode.ACCOUNT_NOT_FOUND : ErrorCode.INTERNAL_ERROR;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ isError: true, error: { code: errorCode, message: err.message } }),
          }],
        };
      }
    }
  );
}
