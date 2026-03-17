export interface Quote {
  id: string;
  account_id: string;
  tool_id: string;
  amount_usd: number;
  amount_gero?: number;
  consumed: boolean;
  expires_at: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}
