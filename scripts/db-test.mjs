import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../data/ledger.db');

console.log('📂 DB Path:', dbPath);

const db = new Database(dbPath);

console.log('\n🧪 Testing MCP Payment Gateway\n');

// Test 1: Check accounts
console.log('1. Accounts:');
const accounts = db.prepare('SELECT id, name, balance_usd, balance_gero, balance_btc FROM accounts LIMIT 3').all();
accounts.forEach(a => console.log(`   - ${a.name}: USD=${a.balance_usd}, GERO=${a.balance_gero}, BTC=${a.balance_btc}`));

// Test 2: Check tools
console.log('\n2. Registered Tools:');
const tools = db.prepare('SELECT id, name, price_usd, price_gero, price_btc, accepted_currencies FROM registered_tools LIMIT 5').all();
tools.forEach(t => console.log(`   - ${t.name}: $${t.price_usd} / ${t.price_gero} GERO / ${t.price_btc} BTC`));

// Test 3: Check payments
console.log('\n3. Recent Payments:');
const payments = db.prepare('SELECT id, amount_usd, amount_gero, amount_btc, currency, status, created_at FROM payments ORDER BY created_at DESC LIMIT 5').all();
payments.forEach(p => console.log(`   - ${p.currency} ${p.amount_usd || p.amount_gero || p.amount_btc} (${p.status})`));

// Test 4: Check revenue
console.log('\n4. MCP Revenue:');
const revenue = db.prepare('SELECT SUM(amount_gero) as gero, SUM(amount_btc) as btc, SUM(amount_usd) as usd FROM mcp_revenue').get();
console.log(`   - GERO: ${revenue.gero || 0}`);
console.log(`   - BTC: ${revenue.btc || 0}`);
console.log(`   - USD: ${revenue.usd || 0}`);

console.log('\n✅ Database tests complete!');
db.close();
