import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Ledger as LedgerType } from '@mcp-pg/ledger';
import type { ServerConfig } from '../config.js';
import { stakeGero } from '@mcp-pg/ledger';
import { ErrorCode } from '@mcp-pg/types';

const DEFAULT_GERO_USD_RATE = 0.05;

export function registerStakeGero(
  server: McpServer,
  ledger: LedgerType,
  _config: ServerConfig
): void {
  (server as any).registerTool(
    'stake_gero',
    {
      description: 'Stake GERO tokens to unlock tier benefits (fee discounts, higher rate limits, fiat off-ramp access).',
      inputSchema: {
        account_id: { type: 'string', description: 'Account ID to stake GERO from' },
        amount: { type: 'number', description: 'Amount of GERO to stake (in units, not lovelace - e.g., 1000 = 1000 GERO)' },
      },
    },
    async (args: any) => {
      const { account_id, amount } = args;

      if (!account_id || !amount) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ isError: true, error: { code: ErrorCode.VALIDATION_ERROR, message: 'account_id and amount are required' } }),
          }],
        };
      }

      if (amount <= 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ isError: true, error: { code: ErrorCode.VALIDATION_ERROR, message: 'amount must be positive' } }),
          }],
        };
      }

      try {
        const result = stakeGero(ledger, account_id, amount, DEFAULT_GERO_USD_RATE);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              account_id,
              staked_amount: result.amount,
              old_tier: result.oldTier,
              new_tier: result.newTier,
              tier_improved: result.tierImproved,
              staked_usd: result.stakedUsd,
              message: result.tierImproved
                ? `Tier improved from ${result.oldTier} to ${result.newTier}!`
                : `Staked ${result.amount} GERO. Keep staking to reach next tier.`,
            }),
          }],
        };
      } catch (err: any) {
        const errorCode = err.message === 'ACCOUNT_NOT_FOUND' ? ErrorCode.ACCOUNT_NOT_FOUND :
                         err.message === 'INSUFFICIENT_BALANCE' ? ErrorCode.INSUFFICIENT_BALANCE :
                         ErrorCode.INTERNAL_ERROR;

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
