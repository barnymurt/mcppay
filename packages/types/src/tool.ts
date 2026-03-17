export interface RegisteredTool {
  id: string;
  name: string;
  description: string;
  price_usd: number;
  price_gero?: number;
  owner_account_id: string;
  active: boolean;
  created_at: string;
}
