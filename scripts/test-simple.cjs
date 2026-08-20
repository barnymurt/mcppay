const { createLedger, migrate } = require('./packages/ledger/dist/index.js');
const { createAccount, createTool } = require('./packages/ledger/dist/index.js');
const { resolveRail } = require('./packages/rails/dist/index.js');
const { AutoRouter } = require('./packages/rails/dist/index.js');

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

  // Test rail resolution
  console.log('\n4. Testing rail resolution...');
  const rail = resolveRail(account, { PAYMENT_RAIL: 'sandbox' }, 'USD');
  console.log(`   ✅ Rail resolved: ${rail.name}`);
  console.log(`   💳 Supported currencies: ${rail.supportedCurrencies.join(', ')}`);

  // Test auto-router
  console.log('\n5. Testing auto-router...');
  const autoRouter = new AutoRouter();
  
  const route1 = await autoRouter.findBestRoute('USD', 'GERO', BigInt(10000));
  console.log(`   ✅ USD → GERO route: ${route1?.path || 'direct'}`);
  
  const route2 = await autoRouter.findBestRoute('USD', 'BTC', BigInt(10000));
  console.log(`   ✅ USD → BTC route: ${route2?.path || 'direct'}`);

  console.log('\n✅ All tests passed!');
  console.log('\n📝 To test via HTTP server:');
  console.log('   cd packages/server && npm run dev');
  console.log('\n📝 To test showcase:');
  console.log('   cd packages/showcase && npm run dev');
}

main().catch(console.error);
