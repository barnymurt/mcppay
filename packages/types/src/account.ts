import type { Rail } from './auth.js';

export interface Account {
  id: string;
  name: string;
  rail: Rail;
  balance_usd: number;
  balance_gero: number;
  wallet_address?: string;
  deposit_index?: number;
  created_at: string;
}
