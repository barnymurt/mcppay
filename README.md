# MCP Payment Gateway

An MCP-native payment gateway that enables AI agents to pay for tool calls programmatically.

## Features

- **Quote-before-pay**: Agents always know cost before committing
- **Dual rail support**: Sandbox, GERO (Cardano), Bank transfers
- **Atomic payments**: Single tool call to quote and pay
- **Machine-readable receipts**: Full audit trail with deterministic hashes

## Installation

```bash
npm install
```

## Initialize

```bash
npx @mcp-pg/server init
```

This creates a sandbox account with test balance and prints your API key.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run server in dev mode
cd packages/server && pnpm dev
```

## Docker

```bash
docker build -t mcp-payment-gateway .
docker run -p 3100:3100 -p 3101:3101 mcp-payment-gateway
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_tool_price` | Get price quote for a tool (60s expiry) |
| `pay_for_tool_call` | Execute payment for a quoted tool |
| `get_receipt` | Retrieve payment receipt |
| `get_balance` | Check account balance |
| `top_up_balance` | Add funds to account |
| `authorize_and_pay` | Quote + pay in single call |

## Supported Payment Rails

- **Sandbox**: Fake payments for testing
- **GERO**: Cardano native token (via Blockfrost)
- **Bank**: Fiat transfers (Sachel Bank API adapter)

## Architecture

```
packages/
├── types/       # Shared interfaces
├── ledger/      # SQLite database
├── rails/       # Payment rail implementations
├── server/      # MCP server + HTTP API
└── sdk/         # TypeScript client
```
