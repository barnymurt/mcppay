import { v4 as uuid } from 'uuid';
import { Ledger } from './database.js';
import type { Receipt, Rail } from '@mcp-pg/types';

export interface CreateReceiptParams {
  payment_id: string;
  tool_id: string;
  account_id: string;
  amount_usd: number;
  amount_gero?: number;
  rail: Rail;
  status: 'success' | 'failed';
  audit_hash: string;
}

export function createReceipt(ledger: Ledger, params: CreateReceiptParams): Receipt {
  const db = ledger.raw;
  const id = `receipt_${uuid()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO receipts (id, payment_id, tool_id, account_id, amount_usd, amount_gero, rail, status, timestamp, audit_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.payment_id,
    params.tool_id,
    params.account_id,
    params.amount_usd,
    params.amount_gero || null,
    params.rail,
    params.status,
    now,
    params.audit_hash
  );

  return {
    id,
    payment_id: params.payment_id,
    tool_id: params.tool_id,
    account_id: params.account_id,
    amount_usd: params.amount_usd,
    amount_gero: params.amount_gero,
    rail: params.rail,
    status: params.status,
    timestamp: now,
    audit_hash: params.audit_hash,
  };
}

export function getReceipt(ledger: Ledger, id: string): Receipt | undefined {
  const db = ledger.raw;
  const row = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id) as any;
  if (!row) return undefined;

  return {
    id: row.id,
    payment_id: row.payment_id,
    tool_id: row.tool_id,
    account_id: row.account_id,
    amount_usd: row.amount_usd,
    amount_gero: row.amount_gero,
    rail: row.rail,
    status: row.status,
    timestamp: row.timestamp,
    audit_hash: row.audit_hash,
  };
}

export function getReceiptsByAccount(
  ledger: Ledger,
  accountId: string,
  limit: number = 20,
  cursor?: string
): { receipts: Receipt[]; hasMore: boolean } {
  const db = ledger.raw;
  
  let query = 'SELECT * FROM receipts WHERE account_id = ?';
  const params: any[] = [accountId];

  if (cursor) {
    const cursorReceipt = getReceipt(ledger, cursor);
    if (cursorReceipt) {
      query += ' AND timestamp < ?';
      params.push(cursorReceipt.timestamp);
    }
  }

  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit + 1);

  const rows = db.prepare(query).all(...params) as any[];
  const hasMore = rows.length > limit;
  const receipts = rows.slice(0, limit).map(row => ({
    id: row.id,
    payment_id: row.payment_id,
    tool_id: row.tool_id,
    account_id: row.account_id,
    amount_usd: row.amount_usd,
    amount_gero: row.amount_gero,
    rail: row.rail,
    status: row.status,
    timestamp: row.timestamp,
    audit_hash: row.audit_hash,
  }));

  return { receipts, hasMore };
}
