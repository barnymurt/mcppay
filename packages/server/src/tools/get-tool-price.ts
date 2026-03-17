import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Ledger as LedgerType } from '@mcp-pg/ledger';
import type { ServerConfig } from '../config.js';
import { createQuote, getTool } from '@mcp-pg/ledger';
import { ErrorCode } from '@mcp-pg/types';

export function registerGetToolPrice(
  server: McpServer,
  ledger: LedgerType,
  _config: ServerConfig
): void {
  (server as any).registerTool(
    'get_tool_price',
    {
      description: 'Returns the current USD price in cents for a single call to a registered tool. Creates a quote valid for 60 seconds. Always call this before pay_for_tool_call to confirm cost.',
      inputSchema: {
        tool_id: { type: 'string', description: 'ID of the tool to price' },
        account_id: { type: 'string', description: 'Requesting account ID' },
      },
    },
    async (args: any) => {
      const { tool_id, account_id } = args;
      const tool = getTool(ledger, tool_id);
      
      if (!tool) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ isError: true, error: { code: ErrorCode.TOOL_NOT_FOUND, message: `Tool ${tool_id} not found` } }),
          }],
        };
      }

      if (!tool.active) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ isError: true, error: { code: ErrorCode.TOOL_INACTIVE, message: `Tool ${tool_id} is inactive` } }),
          }],
        };
      }

      const quote = createQuote(ledger, {
        account_id,
        tool_id,
        amount_usd: tool.price_usd,
        amount_gero: tool.price_gero,
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            tool_id: quote.tool_id,
            price_usd_cents: quote.amount_usd,
            price_gero: quote.amount_gero,
            quote_id: quote.id,
            expires_at: quote.expires_at,
            account_id: quote.account_id,
          }),
        }],
      };
    }
  );
}
