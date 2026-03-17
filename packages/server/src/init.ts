// @ts-nocheck
import 'dotenv/config';
import { createLedger, runMigrations, createAccount, createApiKey, createTool } from '@mcp-pg/ledger';
import { getConfig } from './config.js';
import { createLogger } from './logger.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DEFAULT_SANDBOX_BALANCE = 10000;

async function generateApiKey(): Promise<{ raw: string; hash: string; prefix: string }> {
  const raw = `mpg_test_${crypto.randomBytes(16).toString('base64url')}`;
  const hash = crypto.createHash('sha256').update(raw + process.env.API_KEY_SALT).digest('hex');
  const prefix = raw.substring(0, 12);
  return { raw, hash, prefix };
}

async function init() {
  const logger = createLogger('init');
  const config = getConfig();

  const dataDir = path.dirname(config.LEDGER_DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const ledger = createLedger({ path: config.LEDGER_DB_PATH });
  
  try {
    runMigrations(ledger);
    logger.info('Database migrations complete');
  } catch (error) {
    logger.error({ error }, 'Failed to run migrations');
    process.exit(1);
  }

  const account = createAccount(ledger, {
    name: 'sandbox-default',
    rail: 'sandbox',
    balance_usd: DEFAULT_SANDBOX_BALANCE,
    balance_gero: 0,
  });
  logger.info({ accountId: account.id }, 'Created sandbox account');

  const { raw, hash, prefix } = await generateApiKey();
  const apiKey = createApiKey(ledger, {
    account_id: account.id,
    key_hash: hash,
    prefix,
    name: 'bootstrap',
    scopes: ['balance:read', 'balance:topup', 'tools:read', 'tools:register', 'payments:write', 'receipts:read', 'admin'],
  });
  logger.info({ keyId: apiKey.id, prefix }, 'Created bootstrap API key');

  const demoTool = createTool(ledger, {
    name: 'Demo Tool',
    description: 'A demo tool for testing payments',
    price_usd: 1,
    price_gero: 100,
    owner_account_id: account.id,
  });
  logger.info({ toolId: demoTool.id }, 'Created demo tool');

  console.log('\n=== MCP Payment Gateway Initialized ===\n');
  console.log('Sandbox Account Created:');
  console.log(`  Account ID: ${account.id}`);
  console.log(`  Initial Balance: ${DEFAULT_SANDBOX_BALANCE} USD cents\n`);
  console.log('API Key (save this - it will only be shown once):');
  console.log(`  ${raw}\n`);
  console.log('MCP Configuration for Claude/Cursor:');
  console.log(JSON.stringify({
    mcpServers: {
      'mcp-payment-gateway': {
        command: 'npx',
        args: ['@mcp-pg/server', '--stdio'],
        env: {
          PAYMENT_RAIL: 'sandbox',
          LEDGER_DB_PATH: './data/ledger.db',
        },
      },
    },
  }, null, 2));
  console.log('\n');

  ledger.close();
}

init().catch((error) => {
  console.error('Init error:', error);
  process.exit(1);
});
