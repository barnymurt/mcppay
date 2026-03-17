# MCP Payment Gateway — Phase 1 Implementation Spec (v2)

> **Target audience:** AI coding LLM (Claude Code, Cursor, etc.)
> **Goal:** Build a working Phase 1 MCP-native payment gateway in TypeScript/Node with stablecoin settlement and Stripe fiat fallback.
> **Scope:** MCP server, quote/pay/receipt tool suite, SQLite ledger, prepaid balances, TypeScript SDK.
> **Revision note:** v2 adds auth model, rail abstraction, operational concerns, and fixes critical gaps from v1.

---

## 1. Project Overview

Build a developer-first MCP payment gateway that lets AI agents pay for tool calls programmatically. Payment happens inside the tool call — not as a separate user workflow. Every transaction returns a machine-readable receipt.

### Core Principles

- **Agent-first:** no checkout flows, no redirects, no human-in-the-loop unless a spend limit is hit
- **Quote before execute:** agents always know cost before committing
- **Deterministic billing:** idempotent calls, predictable receipts
- **Dual rail:** stablecoin (USDC on Base/Ethereum) for agent-to-agent; Stripe for human operators
- **Sandbox by default:** all features work against a fake ledger before real money is involved
- **Secure by default:** every request is authenticated, every balance mutation is account-scoped

---

## 2. Repository Structure

```
mcp-payment-gateway/
├── packages/
│   ├── types/           # Shared interfaces, Zod schemas, error codes
│   ├── server/          # MCP server + HTTP API (TypeScript)
│   ├── ledger/          # SQLite DB layer, migrations, CRUD helpers
│   ├── sdk/             # TypeScript client SDK
│   └── rails/           # Payment rail implementations (sandbox, stripe, stablecoin)
├── examples/
│   ├── paid-search/     # Reference: paid web search tool
│   ├── paid-scrape/     # Reference: paid scrape tool
│   └── agent-demo/      # End-to-end agent using the SDK
├── migrations/
│   ├── 001_initial.sql
│   └── 002_indexes.sql
├── docker/
│   └── Dockerfile
├── .env.example
├── package.json         # Workspace root (pnpm workspaces)
├── pnpm-workspace.yaml
├── tsconfig.base.json   # Shared TS config, extended by each package
├── vitest.config.ts
└── README.md
```

Use **pnpm workspaces**. Each package has its own `package.json`, `tsconfig.json` (extending `tsconfig.base.json`), and `README.md`.

### Workspace config (`pnpm-workspace.yaml`)

```yaml
packages:
  - 'packages/*'
  - 'examples/*'
```

---

## 3. Environment Variables

```env
# Rail selection
PAYMENT_RAIL=sandbox          # sandbox | stripe | stablecoin | auto
# "auto" logic: use stablecoin if wallet_address is set on the account,
# else use stripe if STRIPE_SECRET_KEY is set, else fall back to sandbox.

# Auth
API_KEY_SALT=random-32-char-salt    # Used to hash API keys before storage
JWT_SECRET=change-me                # Signs short-lived JWTs for internal webhook auth
JWT_EXPIRY=900                      # JWT TTL in seconds (default: 15 min)

# Stripe (fiat fallback)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stablecoin (USDC on Base)
RPC_URL=https://mainnet.base.org
GATEWAY_WALLET_MNEMONIC=...         # BIP-39 mnemonic for HD derivation
USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  # Base USDC
USDC_POLL_INTERVAL_MS=30000         # How often to check for deposits
USDC_CONFIRMATIONS=1                # Blocks to wait before crediting

# Ledger
LEDGER_DB_PATH=./data/ledger.db     # SQLite for Phase 1

# Server
MCP_SERVER_PORT=3100
API_PORT=3101

# Observability
LOG_LEVEL=info                      # trace | debug | info | warn | error
LOG_FORMAT=json                     # json | pretty (use pretty for local dev)

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000          # 1 minute window
RATE_LIMIT_MAX_REQUESTS=100         # per API key per window
```

---

## 4. Authentication & Security Model

### 4.1 API Keys

Every API request (HTTP and SDK) must include an API key. Keys are scoped to an account.

```typescript
// packages/types/src/auth.ts
interface ApiKey {
  id: string;              // uuid
  account_id: string;      // owning account
  key_hash: string;        // SHA-256(raw_key + API_KEY_SALT)
  prefix: string;          // first 8 chars of raw key, for identification
  name: string;            // human label, e.g. "production", "ci"
  scopes: ApiScope[];      // what this key can do
  created_at: string;
  last_used_at?: string;
  revoked_at?: string;     // soft delete
}

type ApiScope =
  | 'balance:read'
  | 'balance:topup'
  | 'tools:read'
  | 'tools:register'
  | 'payments:write'
  | 'receipts:read'
  | 'admin';               // full access, required for account management
```

**Key generation flow:**

1. `POST /accounts/:id/api-keys` (requires existing key with `admin` scope, or the initial bootstrap key)
2. Server generates a random 32-byte key, returns it **once** as `mpg_live_<base64>` (or `mpg_test_` for sandbox)
3. Server stores only `SHA-256(key + salt)` — the raw key is never persisted
4. On every request: hash the provided key, look up by hash, check scopes and revocation

**Bootstrap:** When `npx @mcp-pg/server init` creates a sandbox account, it also generates and prints an admin API key. This is the only time a key is auto-created.

### 4.2 Request Authentication

**HTTP API:** Pass API key in header: `Authorization: Bearer mpg_live_...`

**MCP Server (stdio):** The MCP host is trusted. The `account_id` is passed as a tool argument. No API key needed — stdio transport is single-tenant by nature.

**MCP Server (HTTP/SSE transport):** API key required in the initial connection handshake, passed as a query param or header. The server resolves the account from the key.

### 4.3 Middleware

```typescript
// packages/server/src/middleware/auth.ts
async function authenticate(req: Request): Promise<AuthContext> {
  const raw = extractBearerToken(req);
  if (!raw) throw new AppError('UNAUTHORIZED', 'Missing API key');

  const hash = sha256(raw + config.API_KEY_SALT);
  const apiKey = await db.apiKeys.findByHash(hash);

  if (!apiKey) throw new AppError('UNAUTHORIZED', 'Invalid API key');
  if (apiKey.revoked_at) throw new AppError('UNAUTHORIZED', 'API key revoked');

  await db.apiKeys.touchLastUsed(apiKey.id);

  return { accountId: apiKey.account_id, scopes: apiKey.scopes, apiKeyId: apiKey.id };
}
```

### 4.4 Account Isolation

**Critical rule:** Every DB query that touches account data MUST include `account_id` in the WHERE clause. Never rely solely on a resource ID to locate data — always scope by the authenticated account.

This applies to: quotes, payments, receipts, balance operations, tool registrations.

---

## 5. Data Models (`packages/types`)

All types live in `packages/types/src/` and are imported by every other package. Each type has a corresponding Zod schema for runtime validation.

### 5.1 Account

```typescript
interface Account {
  id: string;              // uuid
  name: string;
  rail: Rail;
  balance_usd: number;     // prepaid balance in USD cents
  wallet_address?: string; // for stablecoin rail
  created_at: string;      // ISO 8601
}

type Rail = 'sandbox' | 'stripe' | 'stablecoin';
```

### 5.2 Quote

```typescript
interface Quote {
  id: string;              // uuid, use as idempotency key
  account_id: string;      // the account this quote was issued to
  tool_id: string;         // identifier for the tool being quoted
  amount_usd: number;      // cost in USD cents
  consumed: boolean;       // true after successful payment
  expires_at: string;      // ISO 8601, default: now + 60 seconds
  created_at: string;
  metadata?: Record<string, unknown>;
}
```

> **v2 fix:** `account_id` added. Quotes are now bound to the requesting account. `pay_for_tool_call` rejects if the paying account doesn't match the quote's account.

### 5.3 Payment

```typescript
interface Payment {
  id: string;
  quote_id: string;
  account_id: string;
  amount_usd: number;
  status: PaymentStatus;
  rail: Rail;
  rail_tx_id?: string;     // Stripe PaymentIntent ID or on-chain tx hash
  receipt_id: string;
  error_code?: ErrorCode;  // set when status is 'failed'
  created_at: string;
  settled_at?: string;
}

type PaymentStatus = 'pending' | 'settled' | 'failed' | 'refunded';
```

### 5.4 Receipt

```typescript
interface Receipt {
  id: string;              // receipt_<uuid>
  payment_id: string;
  tool_id: string;
  account_id: string;
  amount_usd: number;
  rail: Rail;
  status: 'success' | 'failed';
  timestamp: string;       // ISO 8601
  audit_hash: string;      // SHA-256 of canonical string (see 5.4.1)
}
```

#### 5.4.1 Audit Hash Computation

Deterministic, reproducible hash:

```typescript
function computeAuditHash(fields: {
  payment_id: string;
  tool_id: string;
  account_id: string;
  amount_usd: number;
  timestamp: string;
}): string {
  // Canonical string: pipe-delimited, sorted keys
  const canonical = [
    fields.account_id,
    fields.amount_usd.toString(),
    fields.payment_id,
    fields.timestamp,
    fields.tool_id,
  ].join('|');
  return sha256(canonical);
}
```

### 5.5 Tool Registration

```typescript
interface RegisteredTool {
  id: string;              // e.g. "paid-web-search"
  name: string;
  description: string;     // used in MCP tool description
  price_usd: number;       // cost in USD cents per call
  owner_account_id: string;
  active: boolean;         // soft disable without deleting
  created_at: string;
}
```

### 5.6 Error Codes

```typescript
// packages/types/src/errors.ts
enum ErrorCode {
  // Auth
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_API_KEY = 'INVALID_API_KEY',

  // Quote errors
  QUOTE_NOT_FOUND = 'QUOTE_NOT_FOUND',
  QUOTE_EXPIRED = 'QUOTE_EXPIRED',
  QUOTE_ALREADY_USED = 'QUOTE_ALREADY_USED',
  QUOTE_ACCOUNT_MISMATCH = 'QUOTE_ACCOUNT_MISMATCH',

  // Payment errors
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  PAYMENT_FAILED = 'PAYMENT_FAILED',

  // Resource errors
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_INACTIVE = 'TOOL_INACTIVE',
  RECEIPT_NOT_FOUND = 'RECEIPT_NOT_FOUND',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_AMOUNT = 'INVALID_AMOUNT',

  // System
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RAIL_UNAVAILABLE = 'RAIL_UNAVAILABLE',
}

class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}
```

All tools and API endpoints use `AppError`. MCP tools return `{ isError: true, content: [{ type: 'text', text: JSON.stringify({ code, message }) }] }` on failure.

---

## 6. Payment Rail Abstraction (`packages/rails`)

All payment processing goes through a common interface. This avoids scattered if/else branches and makes adding new rails trivial.

### 6.1 Rail Interface

```typescript
// packages/rails/src/types.ts
interface PaymentRail {
  readonly name: Rail;

  /**
   * Deduct funds for a tool call. Returns a settled Payment or throws.
   * For prepaid rails (sandbox), this is synchronous.
   * For async rails, this creates a pending payment.
   */
  processPayment(params: {
    quote: Quote;
    account: Account;
  }): Promise<PaymentResult>;

  /**
   * Initiate a top-up. Returns instructions or a completed result.
   */
  initiateTopUp(params: {
    account: Account;
    amountCents: number;
  }): Promise<TopUpResult>;

  /**
   * Check if this rail can handle the given account.
   */
  canHandle(account: Account): boolean;
}

type PaymentResult =
  | { status: 'settled'; railTxId?: string }
  | { status: 'pending'; railTxId: string };

type TopUpResult =
  | { status: 'completed'; newBalanceCents: number }
  | { status: 'pending'; instructions: Record<string, unknown> };
```

### 6.2 Implementations

```
packages/rails/
├── src/
│   ├── types.ts           # PaymentRail interface
│   ├── factory.ts         # resolveRail(account, config) → PaymentRail
│   ├── sandbox.ts         # SandboxRail implements PaymentRail
│   ├── stripe.ts          # StripeRail implements PaymentRail
│   └── stablecoin.ts      # StablecoinRail implements PaymentRail
├── package.json
└── tsconfig.json
```

### 6.3 Rail Factory

```typescript
// packages/rails/src/factory.ts
function resolveRail(account: Account, config: AppConfig): PaymentRail {
  // Explicit rail on account takes priority
  if (account.rail === 'stablecoin') return new StablecoinRail(config);
  if (account.rail === 'stripe') return new StripeRail(config);
  if (account.rail === 'sandbox') return new SandboxRail(config);

  // "auto" mode fallback chain
  if (account.wallet_address && config.GATEWAY_WALLET_MNEMONIC) {
    return new StablecoinRail(config);
  }
  if (config.STRIPE_SECRET_KEY) {
    return new StripeRail(config);
  }
  return new SandboxRail(config);
}
```

### 6.4 Sandbox Rail

Deducts balance directly via SQLite transaction. Settles instantly.

```typescript
class SandboxRail implements PaymentRail {
  readonly name = 'sandbox' as const;

  async processPayment({ quote, account }): Promise<PaymentResult> {
    // Balance deduction happens in the ledger layer (atomic SQLite tx)
    // This rail just validates and delegates
    return { status: 'settled' };
  }

  async initiateTopUp({ account, amountCents }): Promise<TopUpResult> {
    const newBalance = await ledger.creditBalance(account.id, amountCents);
    return { status: 'completed', newBalanceCents: newBalance };
  }

  canHandle(): boolean { return true; } // always available
}
```

### 6.5 Stripe Rail

```typescript
class StripeRail implements PaymentRail {
  readonly name = 'stripe' as const;

  async initiateTopUp({ account, amountCents }): Promise<TopUpResult> {
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata: { account_id: account.id },
    });
    return {
      status: 'pending',
      instructions: {
        stripe_payment_intent_id: intent.id,
        client_secret: intent.client_secret,
        rail: 'stripe',
      },
    };
  }

  canHandle(account: Account): boolean {
    return !!this.config.STRIPE_SECRET_KEY;
  }

  // processPayment: same as sandbox (prepaid balance deduction)
  // Stripe only handles top-ups differently; spending is always from balance.
}
```

### 6.6 Stablecoin Rail

```typescript
class StablecoinRail implements PaymentRail {
  readonly name = 'stablecoin' as const;

  async initiateTopUp({ account, amountCents }): Promise<TopUpResult> {
    const depositAddress = this.deriveDepositAddress(account.id);
    const usdcAmount = (amountCents / 100).toFixed(2); // e.g. "10.00"
    return {
      status: 'pending',
      instructions: {
        deposit_address: depositAddress,
        usdc_amount: usdcAmount,
        chain: 'base',
        contract: this.config.USDC_CONTRACT_ADDRESS,
        rail: 'stablecoin',
      },
    };
  }

  canHandle(account: Account): boolean {
    return !!account.wallet_address && !!this.config.GATEWAY_WALLET_MNEMONIC;
  }
}
```

---

## 7. Ledger & Database (`packages/ledger`)

### 7.1 Dependencies

```json
{
  "better-sqlite3": "^11.0.0",
  "@types/better-sqlite3": "^7.0.0"
}
```

### 7.2 Migration Strategy

Migrations are plain SQL files in the top-level `migrations/` directory. Each file is named `NNN_description.sql`. The ledger package tracks applied migrations in a `_migrations` table.

```typescript
// packages/ledger/src/migrate.ts
function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare('SELECT filename FROM _migrations').all().map(r => r.filename)
  );

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort(); // lexicographic sort ensures order

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)')
      .run(file, new Date().toISOString());
    logger.info({ migration: file }, 'Applied migration');
  }
}
```

### 7.3 Schema: `migrations/001_initial.sql`

```sql
-- Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rail TEXT NOT NULL DEFAULT 'sandbox' CHECK (rail IN ('sandbox', 'stripe', 'stablecoin')),
  balance_usd INTEGER NOT NULL DEFAULT 0 CHECK (balance_usd >= 0),
  wallet_address TEXT,
  created_at TEXT NOT NULL
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  key_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  scopes TEXT NOT NULL,           -- JSON array, e.g. '["balance:read","payments:write"]'
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
  rail TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  timestamp TEXT NOT NULL,
  audit_hash TEXT NOT NULL UNIQUE
);
```

### 7.4 Schema: `migrations/002_indexes.sql`

```sql
-- Account lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_account ON api_keys(account_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- Quote lookups: find unexpired, unconsumed quotes for an account
CREATE INDEX IF NOT EXISTS idx_quotes_account ON quotes(account_id, consumed, expires_at);

-- Payment queries: by account, by status, by quote
CREATE INDEX IF NOT EXISTS idx_payments_account ON payments(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_quote ON payments(quote_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status) WHERE status = 'pending';

-- Receipt queries: by account (for listing), by payment
CREATE INDEX IF NOT EXISTS idx_receipts_account ON receipts(account_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_receipts_payment ON receipts(payment_id);

-- Tool queries: active tools by owner
CREATE INDEX IF NOT EXISTS idx_tools_owner ON registered_tools(owner_account_id) WHERE active = 1;
```

### 7.5 Atomic Balance Deduction

This is the most critical operation. It MUST be atomic and prevent negative balances.

```typescript
// packages/ledger/src/balance.ts
function deductBalance(db: Database, accountId: string, amountCents: number): number {
  const txn = db.transaction(() => {
    const account = db.prepare(
      'SELECT balance_usd FROM accounts WHERE id = ?'
    ).get(accountId);

    if (!account) throw new AppError(ErrorCode.ACCOUNT_NOT_FOUND, `Account ${accountId} not found`);
    if (account.balance_usd < amountCents) {
      throw new AppError(
        ErrorCode.INSUFFICIENT_BALANCE,
        `Balance ${account.balance_usd} < required ${amountCents}`,
        402,
        { balance: account.balance_usd, required: amountCents }
      );
    }

    const result = db.prepare(
      'UPDATE accounts SET balance_usd = balance_usd - ? WHERE id = ? AND balance_usd >= ?'
    ).run(amountCents, accountId, amountCents);

    if (result.changes !== 1) {
      throw new AppError(ErrorCode.INSUFFICIENT_BALANCE, 'Balance race condition — retry');
    }

    return account.balance_usd - amountCents;
  });

  return txn();
}
```

The double-check (SELECT then UPDATE with WHERE guard) protects against race conditions even if SQLite's WAL mode allows concurrent reads.

---

## 8. MCP Server (`packages/server`)

### 8.1 Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^1.12.0",
  "@mcp-pg/types": "workspace:*",
  "@mcp-pg/ledger": "workspace:*",
  "@mcp-pg/rails": "workspace:*",
  "stripe": "^17.0.0",
  "viem": "^2.0.0",
  "uuid": "^10.0.0",
  "zod": "^3.23.0",
  "dotenv": "^16.0.0",
  "pino": "^9.0.0",
  "pino-pretty": "^11.0.0"
}
```

> **Note:** Pin `@modelcontextprotocol/sdk` to a specific minor version. `"latest"` in a spec leads to broken builds when the API changes.

### 8.2 MCP Tool Definitions

Implement exactly these six tools. Tool names and descriptions are what the model uses to decide when to call them — they must be precise.

---

#### Tool 1: `get_tool_price`

**Description:** `"Returns the current USD price in cents for a single call to a registered tool. Creates a quote valid for 60 seconds. Always call this before pay_for_tool_call to confirm cost."`

**Input schema:**

```typescript
{
  tool_id: string,        // ID of the tool to price
  account_id: string      // requesting account (validated in auth)
}
```

**Output:**

```typescript
{
  tool_id: string,
  price_usd_cents: number,
  quote_id: string,
  expires_at: string,
  account_id: string
}
```

**Logic:**

1. Look up tool in `registered_tools` table; reject if not found or `active = false`
2. Create a Quote record bound to `account_id` (persisted, expires in 60s)
3. Return quote

---

#### Tool 2: `pay_for_tool_call`

**Description:** `"Executes payment for a previously quoted tool call. Atomically deducts from the agent's prepaid balance and returns a receipt. The quote_id must belong to this account and not be expired or already used."`

**Input schema:**

```typescript
{
  quote_id: string,       // from get_tool_price
  account_id: string      // paying agent's account
}
```

**Output:**

```typescript
{
  success: boolean,
  receipt_id: string,
  payment_id: string,
  amount_usd_cents: number,
  balance_remaining_usd_cents: number,
  error?: { code: ErrorCode, message: string }  // present only if success: false
}
```

**Logic:**

1. Load quote; validate: exists, not expired, not consumed
2. **Validate `quote.account_id === account_id`** — reject with `QUOTE_ACCOUNT_MISMATCH` if not
3. Resolve payment rail via `resolveRail(account, config)`
4. Begin SQLite transaction:
   a. Deduct balance atomically (see §7.5)
   b. Mark quote as consumed (`consumed = 1`)
   c. Create Payment record (status: `settled`)
   d. Create Receipt record with audit_hash
5. Commit transaction
6. Return receipt

**Error cases (all use ErrorCode enum):**

- `QUOTE_NOT_FOUND` — quote ID doesn't exist
- `QUOTE_EXPIRED` — quote past `expires_at`
- `QUOTE_ALREADY_USED` — `consumed = 1`
- `QUOTE_ACCOUNT_MISMATCH` — quote was issued to a different account
- `INSUFFICIENT_BALANCE` — balance < amount
- `ACCOUNT_NOT_FOUND` — account ID invalid
- `TOOL_NOT_FOUND` — tool referenced by quote no longer exists
- `TOOL_INACTIVE` — tool has been deactivated since quoting

---

#### Tool 3: `get_receipt`

**Description:** `"Retrieves a payment receipt by receipt_id. Use for audit, verification, or dispute resolution. Only returns receipts belonging to the requesting account."`

**Input schema:**

```typescript
{
  receipt_id: string,
  account_id: string
}
```

**Output:** Full `Receipt` object (see §5.4). Returns error if receipt doesn't exist or doesn't belong to the account.

---

#### Tool 4: `get_balance`

**Description:** `"Returns the current prepaid balance in USD cents for an agent account."`

**Input schema:**

```typescript
{
  account_id: string
}
```

**Output:**

```typescript
{
  account_id: string,
  balance_usd_cents: number,
  rail: Rail
}
```

---

#### Tool 5: `top_up_balance`

**Description:** `"Adds funds to an agent's prepaid balance. In sandbox mode this is instant. In stripe mode it creates a Stripe PaymentIntent. In stablecoin mode it returns a USDC deposit address. The response shape varies by rail."`

**Input schema:**

```typescript
{
  account_id: string,
  amount_usd_cents: number,       // must be > 0
  rail_override?: Rail            // override account's default rail
}
```

**Output:** Delegates to the resolved `PaymentRail.initiateTopUp()` — see §6 for response shapes per rail.

---

#### Tool 6: `authorize_and_pay`

**Description:** `"Convenience tool that quotes a tool price and pays in a single atomic server-side operation. Eliminates the risk of quote expiry between two separate calls. Use when the agent doesn't need to inspect the price before paying."`

**Input schema:**

```typescript
{
  tool_id: string,
  account_id: string
}
```

**Output:** Same as `pay_for_tool_call` output.

**Logic:**

1. Look up tool price
2. Create quote (same as `get_tool_price` but internal, no round-trip)
3. Execute payment (same as `pay_for_tool_call` but within the same transaction)
4. Return receipt

> **v2 addition:** This replaces the client-side `authorizeAndPay()` in the SDK that was vulnerable to race conditions. The SDK method now calls this single server-side tool instead.

---

### 8.3 MCP Server Bootstrap

```typescript
// packages/server/src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createLogger } from './logger.js';
import { createLedger } from '@mcp-pg/ledger';
import { registerTools } from './tools/index.js';
import { createHttpServer } from './http/index.js';
import { startUsdcPoller } from './poller/usdc.js';
import { setupGracefulShutdown } from './lifecycle.js';

const logger = createLogger('server');
const ledger = createLedger(config.LEDGER_DB_PATH);
ledger.runMigrations();

const server = new McpServer({
  name: 'mcp-payment-gateway',
  version: '0.1.0',
});

registerTools(server, ledger, config);

// Transport selection
if (process.argv.includes('--stdio')) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP server started on stdio');
} else {
  // HTTP + SSE transport for remote use
  const httpServer = createHttpServer(ledger, config);
  // Mount MCP SSE endpoint at /mcp
  httpServer.listen(config.MCP_SERVER_PORT, () => {
    logger.info({ port: config.MCP_SERVER_PORT }, 'MCP server started on HTTP');
  });
}

// Start background services
const poller = config.PAYMENT_RAIL !== 'sandbox'
  ? startUsdcPoller(ledger, config)
  : null;

// Graceful shutdown
setupGracefulShutdown({ server, httpServer, poller, ledger, logger });
```

---

## 9. HTTP API (`packages/server`)

Exposed on `API_PORT` alongside the MCP server. All routes go through auth middleware (§4.3) except `/webhooks/stripe` and `/health`.

### 9.1 Response Envelope

Every endpoint returns:

```typescript
// Success
{ data: T, error: null }

// Error
{ data: null, error: { code: ErrorCode, message: string, details?: Record<string, unknown> } }
```

HTTP status codes: `200` (success), `400` (validation), `401` (auth), `402` (insufficient funds), `403` (forbidden scope), `404` (not found), `429` (rate limit), `500` (internal).

### 9.2 Route Table

| Method | Path | Scopes Required | Description |
|--------|------|-----------------|-------------|
| POST | `/accounts` | `admin` | Create account |
| GET | `/accounts/:id` | `balance:read` | Get account + balance |
| POST | `/accounts/:id/topup` | `balance:topup` | Top up balance |
| GET | `/accounts/:id/receipts` | `receipts:read` | List receipts (paginated) |
| POST | `/accounts/:id/api-keys` | `admin` | Create API key |
| DELETE | `/accounts/:id/api-keys/:keyId` | `admin` | Revoke API key |
| POST | `/tools/register` | `tools:register` | Register a payable tool |
| GET | `/tools/:id` | `tools:read` | Get tool + price |
| GET | `/tools` | `tools:read` | List all active tools |
| GET | `/receipts/:id` | `receipts:read` | Get single receipt |
| POST | `/webhooks/stripe` | *(none — signature verified)* | Stripe webhook handler |
| GET | `/health` | *(none)* | Health check |

### 9.3 Pagination

List endpoints (`/accounts/:id/receipts`, `/tools`) support cursor-based pagination:

```
GET /accounts/:id/receipts?limit=20&after=receipt_abc123
```

Returns: `{ data: Receipt[], cursor: { next?: string, has_more: boolean } }`

### 9.4 Rate Limiting

Use an in-memory sliding window counter keyed by `apiKeyId`.

```typescript
// packages/server/src/middleware/rateLimit.ts
const windows = new Map<string, { count: number; resetAt: number }>();

function rateLimit(apiKeyId: string, config: AppConfig): void {
  const now = Date.now();
  const window = windows.get(apiKeyId);

  if (!window || now > window.resetAt) {
    windows.set(apiKeyId, { count: 1, resetAt: now + config.RATE_LIMIT_WINDOW_MS });
    return;
  }

  if (window.count >= config.RATE_LIMIT_MAX_REQUESTS) {
    throw new AppError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded. Retry after ${new Date(window.resetAt).toISOString()}`,
      429,
      { retry_after_ms: window.resetAt - now }
    );
  }

  window.count++;
}
```

Set `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers on every response.

---

## 10. Stripe Integration

Only triggered when `PAYMENT_RAIL=stripe` or account rail is `stripe`.

### 10.1 Top-up Flow

1. Call `stripe.paymentIntents.create({ amount, currency: 'usd', metadata: { account_id } })`
2. Return `client_secret` to caller via `StripeRail.initiateTopUp()`
3. Webhook endpoint (`POST /webhooks/stripe`) listens for events

### 10.2 Webhook Handler

```typescript
// packages/server/src/webhooks/stripe.ts
async function handleStripeWebhook(req: Request, config: AppConfig): Promise<void> {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, config.STRIPE_WEBHOOK_SECRET);

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object;
      const accountId = intent.metadata.account_id;
      if (!accountId) {
        logger.warn({ intentId: intent.id }, 'Stripe webhook: missing account_id in metadata');
        return;
      }
      await ledger.creditBalance(accountId, intent.amount);
      await ledger.createPayment({
        accountId,
        amountUsd: intent.amount,
        status: 'settled',
        rail: 'stripe',
        railTxId: intent.id,
      });
      logger.info({ accountId, amount: intent.amount }, 'Stripe top-up credited');
      break;
    }
    case 'payment_intent.payment_failed': {
      const intent = event.data.object;
      logger.warn({ intentId: intent.id }, 'Stripe payment failed');
      // No balance credit. Optional: create a failed payment record.
      break;
    }
    default:
      logger.debug({ type: event.type }, 'Unhandled Stripe event type');
  }
}
```

### 10.3 Idempotency

Stripe webhooks can fire multiple times. Use `rail_tx_id` (the PaymentIntent ID) as a uniqueness check — if a payment with that `rail_tx_id` already exists, skip the credit.

---

## 11. Stablecoin Integration (USDC on Base)

Only triggered when `PAYMENT_RAIL=stablecoin` or account rail is `stablecoin`.

Use **viem** for all on-chain operations.

### 11.1 HD Wallet Derivation

Derive a unique deposit address per account using BIP-44 from the gateway mnemonic.

```typescript
// packages/rails/src/stablecoin.ts
import { mnemonicToAccount } from 'viem/accounts';

// Derivation path: m/44'/60'/0'/0/<account_index>
// account_index is stored in the accounts table (auto-incremented)

function deriveDepositAddress(mnemonic: string, accountIndex: number): `0x${string}` {
  const account = mnemonicToAccount(mnemonic, {
    addressIndex: accountIndex,
  });
  return account.address;
}
```

**Account index mapping:** Add a `deposit_index INTEGER` column to the `accounts` table (auto-assigned on creation, starting from 0). This deterministically maps each account to a unique HD-derived address.

### 11.2 USDC Deposit Poller

```typescript
// packages/server/src/poller/usdc.ts
import { createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';

const USDC_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

function startUsdcPoller(ledger: Ledger, config: AppConfig): { stop: () => void } {
  const client = createPublicClient({ chain: base, transport: http(config.RPC_URL) });
  let lastBlock = 0n;
  let running = true;

  const poll = async () => {
    while (running) {
      try {
        const currentBlock = await client.getBlockNumber();
        if (currentBlock <= lastBlock) { await sleep(config.USDC_POLL_INTERVAL_MS); continue; }

        const logs = await client.getContractEvents({
          address: config.USDC_CONTRACT_ADDRESS as `0x${string}`,
          abi: USDC_ABI,
          eventName: 'Transfer',
          fromBlock: lastBlock + 1n,
          toBlock: currentBlock,
        });

        for (const log of logs) {
          const toAddress = log.args.to!.toLowerCase();
          const account = await ledger.findAccountByDepositAddress(toAddress);
          if (!account) continue;

          const usdcRaw = log.args.value!;           // 6 decimals
          const usdCents = Number(usdcRaw / 10000n); // 1 USDC = 100 cents

          // Idempotency: check if tx hash already processed
          if (await ledger.paymentExistsByRailTxId(log.transactionHash)) continue;

          await ledger.creditBalance(account.id, usdCents);
          await ledger.createPayment({
            accountId: account.id,
            amountUsd: usdCents,
            status: 'settled',
            rail: 'stablecoin',
            railTxId: log.transactionHash,
          });
          logger.info({ accountId: account.id, usdCents, tx: log.transactionHash }, 'USDC deposit credited');
        }

        lastBlock = currentBlock;
      } catch (err) {
        logger.error({ err }, 'USDC poller error');
      }
      await sleep(config.USDC_POLL_INTERVAL_MS);
    }
  };

  poll();
  return { stop: () => { running = false; } };
}
```

### 11.3 USDC Conversion

- Store all balances in USD cents internally
- USDC has 6 decimals: `1 USDC = 1_000_000` raw units
- Conversion: `usdCents = Number(usdcRaw / 10_000n)`
- Phase 1 assumes **1 USDC = 1 USD** (no oracle needed)

---

## 12. Observability

### 12.1 Structured Logging

Use **pino** for structured JSON logging throughout.

```typescript
// packages/server/src/logger.ts
import pino from 'pino';

export function createLogger(name: string) {
  return pino({
    name,
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.LOG_FORMAT === 'pretty'
      ? { target: 'pino-pretty' }
      : undefined,
  });
}
```

### 12.2 Request Tracing

Generate a `request_id` (UUID) for every incoming HTTP request and MCP tool call. Include it in:
- Every log line
- The response envelope
- Error responses

```typescript
// Middleware
function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  req.log = logger.child({ requestId: req.id });
  next();
}
```

### 12.3 Key Events to Log

| Event | Level | Fields |
|-------|-------|--------|
| Quote created | `info` | `quoteId, toolId, accountId, amountCents` |
| Payment settled | `info` | `paymentId, quoteId, accountId, amountCents, rail` |
| Payment failed | `warn` | `quoteId, accountId, errorCode, reason` |
| Balance deducted | `info` | `accountId, amountCents, newBalance` |
| Balance credited | `info` | `accountId, amountCents, newBalance, rail, railTxId` |
| USDC deposit detected | `info` | `accountId, usdCents, txHash, blockNumber` |
| Stripe webhook received | `info` | `eventType, intentId` |
| Auth failure | `warn` | `reason, keyPrefix` |
| Rate limit hit | `warn` | `apiKeyId, limit, windowMs` |

---

## 13. Lifecycle & Graceful Shutdown

```typescript
// packages/server/src/lifecycle.ts
interface ShutdownDeps {
  server?: McpServer;
  httpServer?: http.Server;
  poller?: { stop: () => void };
  ledger: Ledger;
  logger: pino.Logger;
}

function setupGracefulShutdown(deps: ShutdownDeps): void {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    deps.logger.info({ signal }, 'Shutting down gracefully...');

    // 1. Stop accepting new connections
    deps.httpServer?.close();

    // 2. Stop background services
    deps.poller?.stop();

    // 3. Close MCP server
    await deps.server?.close();

    // 4. Close database
    deps.ledger.close();

    deps.logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Docker sends SIGTERM, give 10s then force kill
  setTimeout(() => {
    deps.logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}
```

---

## 14. TypeScript SDK (`packages/sdk`)

```typescript
// packages/sdk/src/index.ts
import type { Quote, Receipt, Rail, ErrorCode } from '@mcp-pg/types';

export class PaymentGatewayClient {
  private baseUrl: string;
  private apiKey: string;
  private accountId: string;

  constructor(config: {
    baseUrl: string;       // HTTP API endpoint (not MCP)
    apiKey: string;        // mpg_live_... or mpg_test_...
    accountId: string;
  }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.accountId = config.accountId;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const envelope = await res.json();
    if (envelope.error) {
      throw new PaymentGatewayError(envelope.error.code, envelope.error.message, res.status);
    }
    return envelope.data as T;
  }

  async getToolPrice(toolId: string): Promise<Quote> {
    return this.request('POST', `/tools/${toolId}/quote`, { account_id: this.accountId });
  }

  async payForToolCall(quoteId: string): Promise<PaymentResult> {
    return this.request('POST', `/payments`, { quote_id: quoteId, account_id: this.accountId });
  }

  async getReceipt(receiptId: string): Promise<Receipt> {
    return this.request('GET', `/receipts/${receiptId}`);
  }

  async getBalance(): Promise<BalanceResult> {
    return this.request('GET', `/accounts/${this.accountId}`);
  }

  async topUp(amountCents: number, rail?: Rail): Promise<TopUpResult> {
    return this.request('POST', `/accounts/${this.accountId}/topup`, {
      amount_usd_cents: amountCents,
      rail_override: rail,
    });
  }

  /**
   * Quote + pay in a single server-side atomic operation.
   * Calls the authorize_and_pay MCP tool via the HTTP bridge.
   * No client-side expiry check — the server is the source of truth.
   */
  async authorizeAndPay(toolId: string): Promise<PaymentResult> {
    return this.request('POST', `/payments/authorize`, {
      tool_id: toolId,
      account_id: this.accountId,
    });
  }
}

export class PaymentGatewayError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'PaymentGatewayError';
  }
}
```

Export all types. Publish as `@mcp-pg/sdk`.

---

## 15. Reference Example: Paid Web Search (`examples/paid-search`)

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PaymentGatewayClient } from '@mcp-pg/sdk';

const gateway = new PaymentGatewayClient({
  baseUrl: 'http://localhost:3101',
  apiKey: process.env.MPG_API_KEY!,
  accountId: process.env.MPG_ACCOUNT_ID!,
});

// 1. Register the tool on startup
await fetch('http://localhost:3101/tools/register', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.MPG_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    id: 'paid-web-search',
    name: 'Paid Web Search',
    description: 'Performs a web search. Costs 2 cents per query.',
    price_usd_cents: 2,
  }),
});

// 2. Expose as an MCP tool
const server = new McpServer({ name: 'paid-search-example', version: '0.1.0' });

server.tool(
  'paid_web_search',
  'Search the web. Costs 2 cents per query. Payment is handled automatically.',
  { query: { type: 'string', description: 'Search query' } },
  async ({ query }) => {
    // Atomic quote + pay (server-side)
    const payment = await gateway.authorizeAndPay('paid-web-search');

    // Execute the actual search
    const results = await duckDuckGoSearch(query);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          results,
          receipt_id: payment.receipt_id,
          cost_cents: payment.amount_usd_cents,
        }),
      }],
    };
  }
);
```

---

## 16. Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ packages/
COPY migrations/ migrations/
RUN corepack enable pnpm && pnpm install --frozen-lockfile && pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/server/dist/ ./dist/
COPY --from=builder /app/packages/types/dist/ ./packages/types/dist/
COPY --from=builder /app/packages/ledger/dist/ ./packages/ledger/dist/
COPY --from=builder /app/packages/rails/dist/ ./packages/rails/dist/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY migrations/ ./migrations/
COPY .env.example ./.env.example

ENV NODE_ENV=production
EXPOSE 3100 3101

# Health check
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:3101/health || exit 1

CMD ["node", "dist/index.js"]
```

Multi-stage build to keep the production image small. No dev dependencies in the final image.

---

## 17. One-Command Install (Target UX)

```bash
npx @mcp-pg/server init
```

This should:

1. Create `.env` from `.env.example` with prompted values (or sensible defaults)
2. Run DB migrations via `packages/ledger` migration runner
3. Seed a sandbox account (`id: "sandbox-default"`) with 10,000 test cents
4. Generate and print an admin API key for the sandbox account
5. Print MCP config snippet for `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-payment-gateway": {
      "command": "npx",
      "args": ["@mcp-pg/server", "--stdio"],
      "env": {
        "PAYMENT_RAIL": "sandbox",
        "LEDGER_DB_PATH": "./data/ledger.db"
      }
    }
  }
}
```

---

## 18. Build Order for AI Coding LLM

Implement in this sequence to avoid circular dependencies. Each step should be completable and testable before moving to the next.

| Step | Package | What to Build | Depends On | Testable Milestone |
|------|---------|--------------|------------|-------------------|
| 1 | `packages/types` | All interfaces, Zod schemas, `ErrorCode` enum, `AppError` class | Nothing | Types compile, Zod schemas validate sample data |
| 2 | `packages/ledger` | SQLite wrapper, migration runner, CRUD helpers for all tables | `types` | Unit tests: create account, deduct balance (atomic), check constraint prevents negative |
| 3 | `packages/rails` | `PaymentRail` interface + `SandboxRail` implementation + `resolveRail` factory | `types`, `ledger` | Unit test: sandbox `processPayment` deducts balance, `initiateTopUp` credits |
| 4 | `packages/server` (MCP tools only) | Register 6 MCP tools, wire to sandbox rail, stdio transport | `types`, `ledger`, `rails` | Integration test: `get_tool_price → pay_for_tool_call → get_receipt` via stdio |
| 5 | `packages/server` (HTTP API) | REST endpoints, auth middleware, rate limiter, request tracing | `types`, `ledger`, `rails` | Integration test: `curl` against running server with API key |
| 6 | `packages/server` (auth) | API key generation, hashing, scope validation, middleware | `types`, `ledger` | Unit test: key generation, hash verification, scope rejection |
| 7 | `packages/rails` (Stripe) | `StripeRail`, webhook handler, idempotent credit | `types`, `ledger` | Integration test with mocked Stripe: top-up → webhook → balance credited |
| 8 | `packages/rails` (Stablecoin) | `StablecoinRail`, HD derivation, USDC poller | `types`, `ledger` | Integration test with mocked viem: deposit detected → balance credited |
| 9 | `packages/sdk` | `PaymentGatewayClient`, typed errors | `types` | Integration test: SDK against running server, `authorizeAndPay` works end-to-end |
| 10 | `examples/` | `paid-search`, `agent-demo` | `sdk`, `server` | Run example, confirm payment + receipt flow |
| 11 | Docker + CLI | `Dockerfile`, `init` command | Everything | `npx @mcp-pg/server init` works, Docker image builds and runs |

---

## 19. Testing Requirements

### 19.1 Framework

Use **Vitest** for all tests. Configure in root `vitest.config.ts`.

### 19.2 Unit Tests (`packages/types`, `packages/ledger`, `packages/rails`)

- Quote expiry validation (exact boundary: 60s ± 0)
- Quote account binding (reject mismatched account)
- Idempotency: paying same quote twice returns `QUOTE_ALREADY_USED`
- Negative balance prevention: concurrent deductions, constraint fires
- Receipt audit_hash: deterministic given same inputs
- API key hashing: hash(key + salt) matches stored hash
- Scope validation: reject calls with insufficient scopes
- Error code enum: every error path returns a valid `ErrorCode`

### 19.3 Integration Tests (`packages/server`)

- Full flow: `get_tool_price → pay_for_tool_call → get_receipt` against sandbox ledger
- Atomic `authorize_and_pay` flow
- HTTP API: auth → create account → top-up → list receipts
- Stripe webhook: mock `payment_intent.succeeded` → balance credited (idempotent on replay)
- USDC poller: mock viem events → balance credited (idempotent on duplicate tx)
- Rate limiter: exceed limit → get `429` with `retry_after`

### 19.4 Test Isolation

- Each test suite gets a fresh in-memory SQLite database (`':memory:'`)
- No real Stripe or on-chain calls in CI — mock both rails
- Use `vi.useFakeTimers()` for quote expiry tests

---

## 20. Out of Scope for Phase 1

Do not implement:

- Spend limits / policy engine (Phase 2)
- Dashboard UI (Phase 2)
- Escrow / cross-agent settlement (Phase 3)
- Token-based pricing or volatile crypto
- Multi-sig wallets
- Refund/dispute flows (Phase 2)
- Multi-currency support (everything is USD for now)
- Webhook notifications to tool owners on payment
- Account deletion or data export

---

## 21. Success Criteria

Phase 1 is done when:

- [ ] All 6 MCP tools respond correctly via stdio transport
- [ ] All 6 MCP tools respond correctly via HTTP/SSE transport
- [ ] A sandbox agent can quote, pay, and retrieve a receipt in < 200ms
- [ ] `authorize_and_pay` completes atomically in a single tool call
- [ ] Auth middleware rejects requests with missing, invalid, or revoked API keys
- [ ] Scope enforcement: a `balance:read`-only key cannot call `pay_for_tool_call`
- [ ] Quote-to-account binding: paying with a different account returns `QUOTE_ACCOUNT_MISMATCH`
- [ ] Rate limiter returns `429` with `retry_after` when exceeded
- [ ] Stripe top-up creates a PaymentIntent and credits balance on webhook (idempotent)
- [ ] USDC deposit on Base credits balance after 1 block confirmation (idempotent)
- [ ] `npx @mcp-pg/server init` works end-to-end, prints API key and MCP config
- [ ] TypeScript SDK `authorizeAndPay()` works against a running server
- [ ] `paid-search` reference example runs without errors
- [ ] All unit + integration tests pass
- [ ] Structured JSON logs emitted for all key events (§12.3)
- [ ] Graceful shutdown on SIGTERM: poller stops, DB closes, no data loss
- [ ] Docker image builds, starts, and passes health check
