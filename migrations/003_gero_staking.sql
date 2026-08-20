-- GERO Staking: Tier system for fee discounts and rate limits
-- Adds staking columns to accounts table

-- Add GERO staking columns to accounts
ALTER TABLE accounts ADD COLUMN gero_staked INTEGER DEFAULT 0;
ALTER TABLE accounts ADD COLUMN gero_staked_usd_at_stake REAL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN stake_tier INTEGER DEFAULT 0;
ALTER TABLE accounts ADD COLUMN staked_at TEXT;
ALTER TABLE accounts ADD COLUMN unstake_pending_at TEXT;
ALTER TABLE accounts ADD COLUMN unstake_amount INTEGER DEFAULT 0;

-- Stake history for audit trail
CREATE TABLE IF NOT EXISTS stake_history (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  action TEXT NOT NULL CHECK (action IN ('stake', 'unstake_request', 'unstake_complete')),
  amount INTEGER NOT NULL,
  tier_before INTEGER,
  tier_after INTEGER,
  timestamp TEXT NOT NULL
);

-- Index for stake history lookups by account
CREATE INDEX IF NOT EXISTS idx_stake_history_account ON stake_history(account_id, timestamp DESC);
