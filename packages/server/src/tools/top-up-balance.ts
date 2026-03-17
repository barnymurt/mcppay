import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Ledger as LedgerType } from '@mcp-pg/ledger';
import type { ServerConfig } from '../config.js';
import { getAccount } from '@mcp-pg/ledger';
import { resolveRail } from '@mcp-pg/rails';
import { ErrorCode, type Rail } from '@mcp-pg/types';

export function registerTopUpBalance(
  server: McpServer,
  ledger: LedgerType,
  config: ServerConfig
): void {
  (server as any).registerTool(
    'top_up_balance',
    {
      description: 'Adds funds to an agent\'s prepaid balance. In sandbox mode this is instant. In gerorail mode it returns a GERO deposit address. In bank mode it returns bank transfer instructions.',
      inputSchema: {
        account_id: { type: 'string', description: 'Account ID to top up' },
        amount_usd_cents: { type: 'number', description: 'Amount in USD cents' },
        amount_gero: { type: 'number', description: 'Amount in GERO (optional, for GERO rail)' },
        rail_override: { type: 'string', description: 'Override default rail (optional)' },
      },
    },
    async (args: any) => {
      const { account_id, amount_usd_cents, amount_gero, rail_override } = args;
      const account = getAccount(ledger, account_id);

      if (!account) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ isError: true, error: { code: ErrorCode.ACCOUNT_NOT_FOUND, message: 'Account not found' } }),
          }],
        };
      }

      if (amount_usd_cents <= 0 && (!amount_gero || amount_gero <= 0)) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ isError: true, error: { code: ErrorCode.INVALID_AMOUNT, message: 'Amount must be greater than 0' } }),
          }],
        };
      }

      const targetRail = (rail_override as Rail) || account.rail;
      const topUpAccount = { ...account, rail: targetRail };
      const rail = resolveRail(topUpAccount, config);

      const result = await rail.initiateTopUp({
        account: topUpAccount,
        amountCents: amount_usd_cents || 0,
        amountGero: amount_gero,
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: result.status,
            new_balance_usd_cents: result.newBalanceCents,
            new_balance_gero: result.newBalanceGero,
            instructions: result.instructions,
          }),
        }],
      };
    }
  );
}
