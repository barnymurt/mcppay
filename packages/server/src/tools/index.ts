import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Ledger as LedgerType } from '@mcp-pg/ledger';
import type { ServerConfig } from '../config.js';
import { registerGetToolPrice } from './get-tool-price.js';
import { registerPayForToolCall } from './pay-for-tool-call.js';
import { registerGetReceipt } from './get-receipt.js';
import { registerGetBalance } from './get-balance.js';
import { registerTopUpBalance } from './top-up-balance.js';
import { registerAuthorizeAndPay } from './authorize-and-pay.js';

export function registerTools(
  server: McpServer,
  ledger: LedgerType,
  config: ServerConfig
): void {
  registerGetToolPrice(server, ledger, config);
  registerPayForToolCall(server, ledger, config);
  registerGetReceipt(server, ledger, config);
  registerGetBalance(server, ledger, config);
  registerTopUpBalance(server, ledger, config);
  registerAuthorizeAndPay(server, ledger, config);
}
