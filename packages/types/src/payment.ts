import type { Rail } from './auth.js';
import type { ErrorCode } from './errors.js';

export type PaymentStatus = 'pending' | 'settled' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  quote_id: string;
  account_id: string;
  amount_usd: number;
  amount_gero?: number;
  status: PaymentStatus;
  rail: Rail;
  rail_tx_id?: string;
  receipt_id: string;
  error_code?: ErrorCode;
  created_at: string;
  settled_at?: string;
}
