export type Currency = 'USD' | 'GERO' | 'BTC';
export type Rail = 'sandbox' | 'stripe' | 'gerorail' | 'btc' | 'bank';

export type ApiScope =
  | 'balance:read'
  | 'balance:topup'
  | 'tools:read'
  | 'tools:register'
  | 'payments:write'
  | 'receipts:read'
  | 'admin';

export interface ApiKey {
  id: string;
  account_id: string;
  key_hash: string;
  prefix: string;
  name: string;
  scopes: ApiScope[];
  created_at: string;
  last_used_at?: string;
  revoked_at?: string;
}

export interface AuthContext {
  accountId: string;
  scopes: ApiScope[];
  apiKeyId: string;
}
