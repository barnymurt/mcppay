import type { Rail } from './auth.js';
import crypto from 'crypto';

export interface Receipt {
  id: string;
  payment_id: string;
  tool_id: string;
  account_id: string;
  amount_usd: number;
  amount_gero?: number;
  rail: Rail;
  status: 'success' | 'failed';
  timestamp: string;
  audit_hash: string;
}

export function computeAuditHash(fields: {
  payment_id: string;
  tool_id: string;
  account_id: string;
  amount_usd: number;
  amount_gero?: number;
  timestamp: string;
}): string {
  const parts = [
    fields.account_id,
    fields.amount_usd.toString(),
    fields.amount_gero?.toString() || '',
    fields.payment_id,
    fields.timestamp,
    fields.tool_id,
  ].join('|');

  return crypto.createHash('sha256').update(parts).digest('hex');
}
