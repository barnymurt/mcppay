import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Ledger as LedgerType } from '@mcp-pg/ledger';
import type { ServerConfig } from '../config.js';
import { createQuote, getTool, getAccount, createPayment, createReceipt, deductBalanceUsd, deductBalanceGero, deductBalanceBtc } from '@mcp-pg/ledger';
import { resolveRail } from '@mcp-pg/rails';
import { ErrorCode, computeAuditHash } from '@mcp-pg/types';
import { v4 as uuid } from 'uuid';

export function registerAuthorizeAndPay(
  server: McpServer,
  ledger: LedgerType,
  config: ServerConfig
): void {
  (server as any).registerTool(
    'authorize_and_pay',
    {
      description: 'Convenience tool that quotes a tool price and pays in a single atomic server-side operation. Eliminates the risk of quote expiry between two separate calls.',
      inputSchema: {
        tool_id: { type: 'string', description: 'Tool ID to pay for' },
        account_id: { type: 'string', description: 'Paying agent account ID' },
      },
    },
    async (args: any) => {
      try {
        const { tool_id, account_id } = args;
        
        const tool = getTool(ledger, tool_id);
        
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

        const account = getAccount(ledger, account_id);
        if (!account) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ isError: true, error: { code: ErrorCode.ACCOUNT_NOT_FOUND, message: 'Account not found' } }),
            }],
          };
        }

        const currency = tool.accepted_currencies[0] || 'USD';
        
        const quote = createQuote(ledger, {
          account_id,
          tool_id,
          amount_usd: tool.price_usd,
          amount_gero: tool.price_gero,
          amount_btc: tool.price_btc,
          currency,
          expires_in_seconds: 60,
        });

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
          tool_id: tool_id,
          account_id,
          amount_usd: quote.amount_usd,
          amount_gero: quote.amount_gero,
          amount_btc: quote.amount_btc,
          currency,
          timestamp,
        });

        const receipt = createReceipt(ledger, {
          payment_id: payment.id,
          tool_id: tool_id,
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
              tool_id: tool_id,
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
