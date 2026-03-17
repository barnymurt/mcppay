import { v4 as uuid } from 'uuid';
import { Ledger } from './database.js';
import type { Quote } from '@mcp-pg/types';

export interface CreateQuoteParams {
  account_id: string;
  tool_id: string;
  amount_usd: number;
  amount_gero?: number;
  expires_in_seconds?: number;
}

export function createQuote(ledger: Ledger, params: CreateQuoteParams): Quote {
  const db = ledger.raw;
  const id = uuid();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (params.expires_in_seconds || 60) * 1000);

  db.prepare(`
    INSERT INTO quotes (id, account_id, tool_id, amount_usd, amount_gero, consumed, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    id,
    params.account_id,
    params.tool_id,
    params.amount_usd,
    params.amount_gero || null,
    expiresAt.toISOString(),
    now.toISOString()
  );

  return {
    id,
    account_id: params.account_id,
    tool_id: params.tool_id,
    amount_usd: params.amount_usd,
    amount_gero: params.amount_gero,
    consumed: false,
    expires_at: expiresAt.toISOString(),
    created_at: now.toISOString(),
  };
}

export function getQuote(ledger: Ledger, id: string): Quote | undefined {
  const db = ledger.raw;
  const row = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id) as any;
  if (!row) return undefined;

  return {
    id: row.id,
    account_id: row.account_id,
    tool_id: row.tool_id,
    amount_usd: row.amount_usd,
    amount_gero: row.amount_gero,
    consumed: Boolean(row.consumed),
    expires_at: row.expires_at,
    created_at: row.created_at,
  };
}

export function consumeQuote(ledger: Ledger, id: string): boolean {
  const db = ledger.raw;
  const result = db.prepare('UPDATE quotes SET consumed = 1 WHERE id = ? AND consumed = 0')
    .run(id);
  return result.changes > 0;
}
