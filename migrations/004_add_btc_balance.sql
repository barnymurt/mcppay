-- Add missing balance_btc column if not exists
ALTER TABLE accounts ADD COLUMN balance_btc INTEGER DEFAULT 0;
