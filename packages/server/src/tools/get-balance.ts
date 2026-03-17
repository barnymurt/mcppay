import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Ledger as LedgerType } from '@mcp-pg/ledger';
import type { ServerConfig } from '../config.js';
import { getAccount } from '@mcp-pg/ledger';
import { ErrorCode } from '@mcp-pg/types';

export function registerGetBalance(
  server: McpServer,
  ledger: LedgerType,
  _config: ServerConfig
): void {
  (server as any).registerTool(
    'get_balance',
    {
      description: 'Returns the current prepaid balance in USD cents and GERO for an agent account.',
      inputSchema: {
        account_id: { type: 'string', description: 'Account ID to check balance' },
      },
    },
    async (args: any) => {
      const { account_id } = args;
      const account = getAccount(ledger, account_id);

      if (!account) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ isError: true, error: { code: ErrorCode.ACCOUNT_NOT_FOUND, message: 'Account not found' } }),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            account_id: account.id,
            balance_usd_cents: account.balance_usd,
            balance_gero: account.balance_gero,
            rail: account.rail,
          }),
        }],
      };
    }
  );
}
