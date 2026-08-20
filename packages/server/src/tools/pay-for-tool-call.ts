import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Ledger as LedgerType } from '@mcp-pg/ledger';
import type { ServerConfig } from '../config.js';
import { getQuote, consumeQuote, getAccount, getTool, createPayment, createReceipt, deductBalanceUsd, deductBalanceGero, deductBalanceBtc } from '@mcp-pg/ledger';
import { resolveRail } from '@mcp-pg/rails';
import { ErrorCode, computeAuditHash } from '@mcp-pg/types';
import { v4 as uuid } from 'uuid';

export function registerPayForToolCall(
  server: McpServer,
  ledger: LedgerType,
  config: ServerConfig
): void {
  (server as any).registerTool(
    'pay_for_tool_call',
    {
      description: 'Executes payment for a previously quoted tool call. Atomically deducts from the agent\'s prepaid balance and returns a receipt.',
      inputSchema: {
        quote_id: { type: 'string', description: 'ID from get_tool_price' },
        account_id: { type: 'string', description: 'Paying agent account ID' },
      },
    },
    async (args: any) => {
      try {
        const { quote_id, account_id } = args;
        
        const quote = getQuote(ledger, quote_id);
        
        if (!quote) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ isError: true, error: { code: ErrorCode.QUOTE_NOT_FOUND, message: 'Quote not found' } }),
            }],
          };
        }

        if (quote.expires_at && new Date(quote.expires_at) < new Date()) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ isError: true, error: { code: ErrorCode.QUOTE_EXPIRED, message: 'Quote has expired' } }),
            }],
          };
        }

        if (quote.consumed) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ isError: true, error: { code: ErrorCode.QUOTE_ALREADY_USED, message: 'Quote already used' } }),
            }],
          };
        }

        if (quote.account_id !== account_id) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ isError: true, error: { code: ErrorCode.QUOTE_ACCOUNT_MISMATCH, message: 'Quote account mismatch' } }),
            }],
          };
        }

        const account = getAccount(ledger, account_id);
        if (!account) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ isError: true, error: { code: ErrorCode.ACCOUNT_NOT_FOUND, message: 'Account not found' } }),
            }],
          };
        }

        const tool = getTool(ledger, quote.tool_id);
        if (!tool) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ isError: true, error: { code: ErrorCode.TOOL_NOT_FOUND, message: 'Tool not found' } }),
            }],
          };
        }

        if (!tool.active) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ isError: true, error: { code: ErrorCode.TOOL_INACTIVE, message: 'Tool is inactive' } }),
            }],
          };
        }

        const currency = quote.currency || 'USD';
        const rail = resolveRail(account, config, currency);
        const paymentResult = await rail.processPayment({ quote, account, currency });

        const receiptId = `receipt_${uuid()}`;
        const timestamp = new Date().toISOString();

        let newBalance: number;
        
        if (currency === 'GERO' && quote.amount_gero) {
          newBalance = Number(deductBalanceGero(ledger, account_id, BigInt(quote.amount_gero)));
        } else if (currency === 'BTC' && quote.amount_btc) {
          newBalance = Number(deductBalanceBtc(ledger, account_id, BigInt(quote.amount_btc)));
        } else {
          newBalance = deductBalanceUsd(ledger, account_id, quote.amount_usd);
        }

        consumeQuote(ledger, quote_id);

        const payment = createPayment(ledger, {
          quote_id: quote.id,
          account_id,
          amount_usd: quote.amount_usd,
          amount_gero: quote.amount_gero,
          amount_btc: quote.amount_btc,
          currency,
          status: paymentResult.status === 'settled' ? 'settled' : 'pending',
          rail: rail.name,
          rail_tx_id: paymentResult.railTxId,
          receipt_id: receiptId,
          settled_at: paymentResult.status === 'settled' ? timestamp : undefined,
        });

        const auditHash = computeAuditHash({
          payment_id: payment.id,
          tool_id: quote.tool_id,
          account_id,
          amount_usd: quote.amount_usd,
          amount_gero: quote.amount_gero,
          amount_btc: quote.amount_btc,
          currency,
          timestamp,
        });

        const receipt = createReceipt(ledger, {
          payment_id: payment.id,
          tool_id: quote.tool_id,
          account_id,
          amount_usd: quote.amount_usd,
          amount_gero: quote.amount_gero,
          amount_btc: quote.amount_btc,
          currency,
          rail: rail.name,
          status: 'success',
          audit_hash: auditHash,
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              receipt_id: receipt.id,
              payment_id: payment.id,
              amount_usd_cents: quote.amount_usd,
              amount_gero: quote.amount_gero,
              balance_remaining_usd_cents: newBalance,
              tool_id: quote.tool_id,
            }),
          }],
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ isError: true, error: { code: ErrorCode.INTERNAL_ERROR, message: error.message || 'Payment failed' } }),
          }],
        };
      }
    }
  );
}
