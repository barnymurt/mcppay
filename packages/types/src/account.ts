import type { Rail, Currency } from './auth.js';

export interface Account {
  id: string;
  name: string;
  rail: Rail;
  balance_usd: number;
  balance_gero: number;
  balance_btc: number;
  balance_ada: number;
  balance_night: number;
  wallet_address?: string;
  deposit_index?: number;
  created_at: string;
  gero_staked?: number;
  gero_staked_usd_at_stake?: number;
  stake_tier?: number;
  staked_at?: string;
  unstake_pending_at?: string;
  unstake_amount?: number;
}

export interface AccountBalance {
  currency: Currency;
  amount: number;
}
