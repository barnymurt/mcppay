# MCP Payment Gateway

An MCP-native payment gateway that enables AI agents to pay for tool calls programmatically using GERO, BTC, or USD.

## Features

- **Multi-currency support**: Pay with USD, GERO (Cardano), or BTC
- **Auto-router**: Best-price routing across Bank, KaiserX, and DEX aggregators
- **Quote-before-pay**: Agents always know cost before committing
- **Atomic payments**: Single tool call to quote and pay
- **Machine-readable receipts**: Full audit trail with deterministic hashes
- **0.5% MCP fee**: Sustainable revenue for operations
- **Rate limiting**: Spam prevention based on account funding

## Installation

```bash
npm install
```

## Quick Start

```bash
# Start HTTP server
cd packages/server
node dist/http-server.js

# Server runs on http://localhost:3101
```

## Development

```bash
# Build all packages
npm run build

# Run tests
npm run test

# Run HTTP server
cd packages/server && node dist/http-server.js

# Run MCP stdio server
cd packages/server && node dist/index.js
```

## Showcase (Vue 3 Demo)

```bash
cd packages/showcase
npm run dev
```

Opens at http://localhost:5173 with:
- **Operator Dashboard**: Fund accounts, view balances
- **Agent Flow Walkthrough**: Animated payment flow demo
- **Public Stats**: Volume charts and leaderboard

## HTTP API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/accounts/:id` | GET | Get account balance |
| `/tools/:id/quote` | POST | Get tool price quote |
| `/payments` | POST | Pay for tool call |
| `/payments/authorize` | POST | Authorize and pay |
| `/receipts/:id` | GET | Get receipt |

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_tool_price` | Get price quote for a tool (60s expiry) |
| `pay_for_tool_call` | Execute payment for a quoted tool |
| `get_receipt` | Retrieve payment receipt |
| `get_balance` | Check account balance (USD, GERO, BTC) |
| `top_up_balance` | Add funds to account |
| `authorize_and_pay` | Quote + pay in single call |

## Supported Payment Rails

| Rail | Currency | Description |
|------|----------|-------------|
| `sandbox` | USD/GERO/BTC | Fake payments for testing |
| `gerorail` | GERO | Cardano native token (via Blockfrost) |
| `btc` | BTC | Bitcoin (via mempool.space) |
| `bank` | USD | Fiat transfers (Sachel Bank API) |

## Multi-Currency Flow

```
Agent (has GERO) → MCP Gateway → Tool Provider (wants BTC)
                                    ↓
                            Auto-router finds best path:
                            - Direct (Bank)
                            - KaiserX exchange
                            - DEX aggregator
```

## Architecture

```
packages/
├── types/           # Shared interfaces (Currency, Account, Payment)
├── ledger/          # SQLite database + balance ops + fees + stats
├── rails/           # Payment rail implementations
│   ├── sandbox.ts   # Mock payments
│   ├── gerorail.ts # Cardano/GERO
│   ├── btc.ts      # Bitcoin
│   ├── auto-router.ts # Best-price routing
├── server/          # MCP server + HTTP API
├── gero-agent-sdk/ # Cardano wallet (reuses @cardano-sdk/core)
├── showcase/       # Vue 3 demo dashboard
└── sdk/            # TypeScript client
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LEDGER_DB_PATH` | `./data/ledger.db` | SQLite database path |
| `MOCK_MODE` | `true` | Use mock transactions |
| `IS_TESTNET` | `true` | Use testnet (preprod) |
| `PAYMENT_RAIL` | `sandbox` | Payment rail: sandbox/gerorail/btc/bank |
| `BLOCKFROST_PROJECT_ID` | - | Blockfrost API key |
| `MEMPOOL_API_URL` | mempool.space | Bitcoin API |

## Database Schema

- **accounts**: id, name, rail, balance_usd, balance_gero, balance_btc
- **registered_tools**: id, name, price_usd, price_gero, price_btc, accepted_currencies
- **quotes**: id, account_id, tool_id, amount_usd, amount_gero, amount_btc, currency
- **payments**: id, quote_id, amount_usd, amount_gero, amount_btc, currency, mcp_fee_*
- **receipts**: id, payment_id, tool_id, amount_*, currency, audit_hash
- **mcp_revenue**: Collected fees (0.5% per transaction)
- **rate_limits**: Per-account rate limiting
