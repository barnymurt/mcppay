// Demo script showing the payment flow
import { PaymentGatewayClient } from './packages/sdk/dist/index.js';

const client = new PaymentGatewayClient({
  baseUrl: 'http://localhost:3101',
  apiKey: 'mpg_test_rEEq6NBsm0kRLBN3OY_ZXw',
  accountId: '64b3d217-6a99-4a75-b40e-edbc5b30c1c5',
});

console.log('=== MCP Payment Gateway Demo ===\n');

// Step 1: Check balance
console.log('1. Check initial balance:');
const balance1 = await client.getBalance();
console.log(`   Balance: ${balance1.balance_usd_cents} USD cents`);
console.log(`   GERO: ${balance1.balance_gero}`);
console.log(`   Rail: ${balance1.rail}\n`);

// Step 2: Get tool price (creates a quote)
console.log('2. Get tool price (creates 60s quote):');
const toolId = 'tool_45b91fec-1e08-444e-9912-4377c8c89a60';
const quote = await client.getToolPrice(toolId);
console.log(`   Quote ID: ${quote.id}`);
console.log(`   Price: ${quote.amount_usd} USD cents`);
console.log(`   GERO: ${quote.amount_gero || 'N/A'}`);
console.log(`   Expires: ${quote.expires_at}\n`);

// Step 3: Pay for tool call
console.log('3. Pay for tool call:');
const payment = await client.payForToolCall(quote.id);
console.log(`   Success: ${payment.success}`);
console.log(`   Receipt ID: ${payment.receipt_id}`);
console.log(`   Amount: ${payment.amount_usd_cents} cents`);
console.log(`   Remaining: ${payment.balance_remaining_usd_cents} cents\n`);

// Step 4: Get receipt
console.log('4. Get receipt:');
const receipt = await client.getReceipt(payment.receipt_id);
console.log(`   Receipt ID: ${receipt.id}`);
console.log(`   Tool ID: ${receipt.tool_id}`);
console.log(`   Amount: ${receipt.amount_usd} cents`);
console.log(`   Status: ${receipt.status}`);
console.log(`   Audit Hash: ${receipt.audit_hash.slice(0, 20)}...\n`);

// Step 5: Check final balance
console.log('5. Check final balance:');
const balance2 = await client.getBalance();
console.log(`   Balance: ${balance2.balance_usd_cents} USD cents (was 10000 - 1 = 9999)\n`);

// Step 6: Demo authorize_and_pay (single atomic call)
console.log('6. authorize_and_pay (quote + pay in one call):');
const payment2 = await client.authorizeAndPay(toolId);
console.log(`   Success: ${payment2.success}`);
console.log(`   Receipt ID: ${payment2.receipt_id}`);
console.log(`   Remaining: ${payment2.balance_remaining_usd_cents} cents\n`);

console.log('=== Demo Complete ===');
