import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Ledger as LedgerType } from '@mcp-pg/ledger';
import type { ServerConfig } from '../config.js';
import { requestUnstake } from '@mcp-pg/ledger';
import { ErrorCode } from '@mcp-pg/types';

export function registerUnstakeGero(
  server: McpServer,
  ledger: LedgerType,
  _config: ServerConfig
): void {
  (server as any).registerTool(
    'unstake_gero',
    {
      description: 'Request to unstake GERO tokens. Tokens will be locked for 24 hours before becoming available.',
      inputSchema: {
        account_id: { type: 'string', description: 'Account ID to unstake GERO from' },
        amount: { type: 'number', description: 'Amount of GERO to unstake (in units, not lovelace)' },
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
        const result = requestUnstake(ledger, account_id, amount);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              account_id,
              amount: result.amount,
              available_at: result.availableAt,
              lockup_hours: result.lockupHours,
              message: `Unstake requested. ${result.amount} GERO will be available at ${result.availableAt} (24h lockup)`,
            }),
          }],
        };
      } catch (err: any) {
        const errorCode = err.message === 'ACCOUNT_NOT_FOUND' ? ErrorCode.ACCOUNT_NOT_FOUND :
                         err.message === 'INSUFFICIENT_STAKED_BALANCE' ? ErrorCode.INSUFFICIENT_BALANCE :
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
