-- Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rail TEXT NOT NULL DEFAULT 'sandbox' CHECK (rail IN ('sandbox', 'stripe', 'gerorail', 'bank')),
  balance_usd INTEGER NOT NULL DEFAULT 0 CHECK (balance_usd >= 0),
  balance_gero INTEGER NOT NULL DEFAULT 0 CHECK (balance_gero >= 0),
  wallet_address TEXT,
  deposit_index INTEGER,
  created_at TEXT NOT NULL
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  key_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  scopes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);

-- Registered Tools
CREATE TABLE IF NOT EXISTS registered_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_usd INTEGER NOT NULL CHECK (price_usd > 0),
  price_gero INTEGER,
  owner_account_id TEXT NOT NULL REFERENCES accounts(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- Quotes
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  tool_id TEXT NOT NULL REFERENCES registered_tools(id),
  amount_usd INTEGER NOT NULL,
  amount_gero INTEGER,
  consumed INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  amount_usd INTEGER NOT NULL,
  amount_gero INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending', 'settled', 'failed', 'refunded')),
  rail TEXT NOT NULL,
  rail_tx_id TEXT,
  receipt_id TEXT NOT NULL,
  error_code TEXT,
  created_at TEXT NOT NULL,
  settled_at TEXT
);

-- Receipts
CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  tool_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  amount_usd INTEGER NOT NULL,
  amount_gero INTEGER,
  rail TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  timestamp TEXT NOT NULL,
  audit_hash TEXT NOT NULL UNIQUE
);

-- Migrations tracking
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);
