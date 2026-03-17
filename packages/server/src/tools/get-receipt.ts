import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Ledger as LedgerType } from '@mcp-pg/ledger';
import type { ServerConfig } from '../config.js';
import { getReceipt } from '@mcp-pg/ledger';
import { ErrorCode } from '@mcp-pg/types';

export function registerGetReceipt(
  server: McpServer,
  ledger: LedgerType,
  _config: ServerConfig
): void {
  (server as any).registerTool(
    'get_receipt',
    {
      description: 'Retrieves a payment receipt by receipt_id. Use for audit, verification, or dispute resolution.',
      inputSchema: {
        receipt_id: { type: 'string', description: 'Receipt ID to retrieve' },
        account_id: { type: 'string', description: 'Account ID for authorization' },
      },
    },
    async (args: any) => {
      const { receipt_id, account_id } = args;
      const receipt = getReceipt(ledger, receipt_id);

      if (!receipt) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ isError: true, error: { code: ErrorCode.RECEIPT_NOT_FOUND, message: 'Receipt not found' } }),
          }],
        };
      }

      if (receipt.account_id !== account_id) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ isError: true, error: { code: ErrorCode.FORBIDDEN, message: 'Receipt belongs to different account' } }),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(receipt),
        }],
      };
    }
  );
}
