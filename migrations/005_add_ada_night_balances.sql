-- Add ADA and NIGHT balances for Cardano ecosystem support
ALTER TABLE accounts ADD COLUMN balance_ada INTEGER DEFAULT 0;
ALTER TABLE accounts ADD COLUMN balance_night INTEGER DEFAULT 0;

-- Update registered_tools to accept new currencies
ALTER TABLE registered_tools ADD COLUMN price_ada INTEGER;
ALTER TABLE registered_tools ADD COLUMN price_night INTEGER;
