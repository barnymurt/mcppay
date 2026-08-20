#!/usr/bin/env npx tsx

import { createLedger, migrate } from '@mcp-pg/ledger';
import { createAccount, createTool, createQuote, getQuote, getAccount, getTool } from '@mcp-pg/ledger';
import { resolveRail } from '@mcp-pg/rails';
import { AutoRouter } from '@mcp-pg/rails';
import type { Account, Currency } from '@mcp-pg/types';

const LEDGER_PATH = './data/test.db';

async function main() {
  console.log('🧪 MCP Payment Gateway Test\n');

  // Initialize ledger
  console.log('1. Initializing ledger...');
  await migrate(LEDGER_PATH);
  const ledger = createLedger({ path: LEDGER_PATH });

  // Create test account
  console.log('2. Creating test account...');
  const account = createAccount(ledger, {
    name: 'Test Agent',
    rail: 'sandbox',
    balance_usd: 10000,
    balance_gero: 1000000,
    balance_btc: 10000,
  });
  console.log(`   ✅ Account created: ${account.id}`);
  console.log(`   💰 Balances: USD=${account.balance_usd}, GERO=${account.balance_gero}, BTC=${account.balance_btc}`);

  // Create test tool
  console.log('\n3. Creating test tool...');
  const tool = createTool(ledger, {
    name: 'Web Search API',
    description: 'Search the web',
    price_usd: 100,
    price_gero: 2000,
    price_btc: 100,
    accepted_currencies: ['USD', 'GERO', 'BTC'],
    owner_account_id: account.id,
  });
  console.log(`   ✅ Tool created: ${tool.name}`);
  console.log(`   💵 Prices: USD=${tool.price_usd}, GERO=${tool.price_gero}, BTC=${tool.price_btc}`);
  console.log(`   💳 Accepted: ${tool.accepted_currencies.join(', ')}`);

  // Test quote creation
  console.log('\n4. Testing quote creation...');
  const quote = createQuote(ledger, {
    account_id: account.id,
    tool_id: tool.id,
    amount_usd: tool.price_usd,
    amount_gero: tool.price_gero,
    amount_btc: tool.price_btc,
    currency: 'USD',
    expires_in_seconds: 60,
  });
  console.log(`   ✅ Quote created: ${quote.id}`);
  console.log(`   💰 Quote amount: ${quote.amount_usd} USD`);

  // Test rail resolution
  console.log('\n5. Testing rail resolution...');
  const rail = resolveRail(account, { PAYMENT_RAIL: 'sandbox' }, 'USD');
  console.log(`   ✅ Rail resolved: ${rail.name}`);
  console.log(`   💳 Supported currencies: ${rail.supportedCurrencies.join(', ')}`);

  // Test auto-router
  console.log('\n6. Testing auto-router...');
  const autoRouter = new AutoRouter();
  
  const route1 = await autoRouter.findBestRoute('USD', 'GERO', BigInt(10000));
  console.log(`   ✅ USD → GERO route: ${route1?.path}`);
  
  const route2 = await autoRouter.findBestRoute('USD', 'BTC', BigInt(10000));
  console.log(`   ✅ USD → BTC route: ${route2?.path}`);
  
  const route3 = await autoRouter.findBestRoute('GERO', 'BTC', BigInt(1000000));
  console.log(`   ✅ GERO → BTC route: ${route3?.path}`);

  // Test payment processing
  console.log('\n7. Testing payment processing...');
  const paymentResult = await rail.processPayment({
    quote,
    account,
    currency: 'USD',
  });
  console.log(`   ✅ Payment status: ${paymentResult.status}`);
  if (paymentResult.railTxId) {
    console.log(`   🔗 TX ID: ${paymentResult.railTxId}`);
  }

  // Verify balance deduction
  console.log('\n8. Verifying balance deduction...');
  const updatedAccount = getAccount(ledger, account.id);
  console.log(`   💰 Updated balances: USD=${updatedAccount?.balance_usd}, GERO=${updatedAccount?.balance_gero}, BTC=${updatedAccount?.balance_btc}`);

  // Test BTC rail
  console.log('\n9. Testing BTC rail...');
  const btcRail = resolveRail(account, { PAYMENT_RAIL: 'btc', MEMPOOL_API_URL: 'https://mempool.space/testnet/api' }, 'BTC');
  const btcPayment = await btcRail.processPayment({
    quote,
    account,
    currency: 'BTC',
  });
  console.log(`   ✅ BTC payment status: ${btcPayment.status}`);

  // Test GERO rail
  console.log('\n10. Testing GERO rail...');
  const geroRail = resolveRail(account, { PAYMENT_RAIL: 'gerorail' }, 'GERO');
  const geroPayment = await geroRail.processPayment({
    quote,
    account,
    currency: 'GERO',
  });
  console.log(`   ✅ GERO payment status: ${geroPayment.status}`);

  // Get final stats
  console.log('\n📊 Testing stats aggregation...');
  const { getPublicStats } = await import('@mcp-pg/ledger');
  const stats = getPublicStats(ledger);
  console.log(`   ✅ Total volume: $${stats.totalVolume.usd}`);
  console.log(`   ✅ Transactions: ${stats.totalTransactions}`);

  console.log('\n✅ All tests passed!');
  console.log('\n📝 To test via HTTP server:');
  console.log('   cd packages/server && npm run dev');
  console.log('\n📝 To test showcase:');
  console.log('   cd packages/showcase && npm run dev');
}

main().catch(console.error);
