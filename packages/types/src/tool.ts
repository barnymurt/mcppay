import type { Currency } from './auth.js';

export interface RegisteredTool {
  id: string;
  name: string;
  description: string;
  price_usd: number;
  price_gero?: number;
  price_btc?: number;
  accepted_currencies: Currency[];
  owner_account_id: string;
  active: boolean;
  created_at: string;
}
