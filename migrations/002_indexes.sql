-- Account lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_account ON api_keys(account_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- Quote lookups: find unexpired, unconsumed quotes for an account
CREATE INDEX IF NOT EXISTS idx_quotes_account ON quotes(account_id, consumed, expires_at);

-- Payment queries: by account, by status, by quote
CREATE INDEX IF NOT EXISTS idx_payments_account ON payments(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_quote ON payments(quote_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_payments_rail_tx ON payments(rail_tx_id) WHERE rail_tx_id IS NOT NULL;

-- Receipt queries: by account (for listing), by payment
CREATE INDEX IF NOT EXISTS idx_receipts_account ON receipts(account_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_receipts_payment ON receipts(payment_id);

-- Tool queries: active tools by owner
CREATE INDEX IF NOT EXISTS idx_tools_owner ON registered_tools(owner_account_id) WHERE active = 1;

-- Account by wallet address (for GERO deposits)
CREATE INDEX IF NOT EXISTS idx_accounts_wallet ON accounts(wallet_address) WHERE wallet_address IS NOT NULL;
