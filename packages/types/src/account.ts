import type { Rail, Currency } from './auth.js';

export interface Account {
  id: string;
  name: string;
  rail: Rail;
  balance_usd: number;
  balance_gero: number;
  balance_btc: number;
  wallet_address?: string;
  deposit_index?: number;
  created_at: string;
}

export interface AccountBalance {
  currency: Currency;
  amount: number;
}
