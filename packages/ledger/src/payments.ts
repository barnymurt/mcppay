import { v4 as uuid } from 'uuid';
import { Ledger } from './database.js';
import type { Payment, PaymentStatus, Rail, ErrorCode, Currency } from '@mcp-pg/types';

export interface CreatePaymentParams {
  quote_id: string;
  account_id: string;
  amount_usd: number;
  amount_gero?: number;
  amount_btc?: number;
  currency?: Currency;
  mcp_fee_gero?: number;
  mcp_fee_btc?: number;
  status: PaymentStatus;
  rail: Rail;
  rail_tx_id?: string;
  receipt_id: string;
  error_code?: ErrorCode;
  settled_at?: string;
}

export function createPayment(ledger: Ledger, params: CreatePaymentParams): Payment {
  const db = ledger.raw;
  const id = uuid();
  const now = new Date().toISOString();
  const currency = params.currency || 'USD';

  db.prepare(`
    INSERT INTO payments (id, quote_id, account_id, amount_usd, amount_gero, amount_btc, currency, mcp_fee_gero, mcp_fee_btc, status, rail, rail_tx_id, receipt_id, error_code, created_at, settled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.quote_id,
    params.account_id,
    params.amount_usd,
    params.amount_gero || null,
    params.amount_btc || null,
    currency,
    params.mcp_fee_gero || null,
    params.mcp_fee_btc || null,
    params.status,
    params.rail,
    params.rail_tx_id || null,
    params.receipt_id,
    params.error_code || null,
    now,
    params.settled_at || null
  );

  return {
    id,
    quote_id: params.quote_id,
    account_id: params.account_id,
    amount_usd: params.amount_usd,
    amount_gero: params.amount_gero,
    amount_btc: params.amount_btc,
    currency,
    mcp_fee_gero: params.mcp_fee_gero,
    mcp_fee_btc: params.mcp_fee_btc,
    status: params.status,
    rail: params.rail,
    rail_tx_id: params.rail_tx_id,
    receipt_id: params.receipt_id,
    error_code: params.error_code,
    created_at: now,
    settled_at: params.settled_at,
  };
}

export function getPayment(ledger: Ledger, id: string): Payment | undefined {
  const db = ledger.raw;
  const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as any;
  if (!row) return undefined;

  return {
    id: row.id,
    quote_id: row.quote_id,
    account_id: row.account_id,
    amount_usd: row.amount_usd,
    amount_gero: row.amount_gero,
    amount_btc: row.amount_btc,
    currency: row.currency || 'USD',
    mcp_fee_gero: row.mcp_fee_gero,
    mcp_fee_btc: row.mcp_fee_btc,
    status: row.status,
    rail: row.rail,
    rail_tx_id: row.rail_tx_id,
    receipt_id: row.receipt_id,
    error_code: row.error_code,
    created_at: row.created_at,
    settled_at: row.settled_at,
  };
}

export function getPaymentByRailTxId(ledger: Ledger, railTxId: string): Payment | undefined {
  const db = ledger.raw;
  const row = db.prepare('SELECT * FROM payments WHERE rail_tx_id = ?').get(railTxId) as any;
  if (!row) return undefined;

  return {
    id: row.id,
    quote_id: row.quote_id,
    account_id: row.account_id,
    amount_usd: row.amount_usd,
    amount_gero: row.amount_gero,
    amount_btc: row.amount_btc,
    currency: row.currency || 'USD',
    mcp_fee_gero: row.mcp_fee_gero,
    mcp_fee_btc: row.mcp_fee_btc,
    status: row.status,
    rail: row.rail,
    rail_tx_id: row.rail_tx_id,
    receipt_id: row.receipt_id,
    error_code: row.error_code,
    created_at: row.created_at,
    settled_at: row.settled_at,
  };
}

export function updatePaymentStatus(
  ledger: Ledger,
  id: string,
  status: PaymentStatus,
  settledAt?: string
): void {
  const db = ledger.raw;
  db.prepare('UPDATE payments SET status = ?, settled_at = ? WHERE id = ?')
    .run(status, settledAt || null, id);
}
