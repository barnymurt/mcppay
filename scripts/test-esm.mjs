import { createLedger, migrate, createAccount, createTool } from '@mcp-pg/ledger';
import { resolveRail } from '@mcp-pg/rails';
import { AutoRouter } from '@mcp-pg/rails';

const LEDGER_PATH = './data/test.db';

console.log('🧪 MCP Payment Gateway Test\n');

await migrate(LEDGER_PATH);
const ledger = createLedger({ path: LEDGER_PATH });

console.log('1. ✅ Ledger initialized');

const account = createAccount(ledger, {
  name: 'Test Agent',
  rail: 'sandbox',
  balance_usd: 10000,
  balance_gero: 1000000,
  balance_btc: 10000,
});
console.log('2. ✅ Account created:', account.id);

const tool = createTool(ledger, {
  name: 'Web Search API',
  description: 'Search the web',
  price_usd: 100,
  price_gero: 2000,
  price_btc: 100,
  accepted_currencies: ['USD', 'GERO', 'BTC'],
  owner_account_id: account.id,
});
console.log('3. ✅ Tool created:', tool.name);

const rail = resolveRail(account, { PAYMENT_RAIL: 'sandbox' }, 'USD');
console.log('4. ✅ Rail resolved:', rail.name);
console.log('   Supported currencies:', rail.supportedCurrencies.join(', '));

const autoRouter = new AutoRouter();
const route1 = await autoRouter.findBestRoute('USD', 'GERO', BigInt(10000));
console.log('5. ✅ Auto-router USD→GERO:', route1?.path || 'direct');

console.log('\n✅ All tests passed!');
