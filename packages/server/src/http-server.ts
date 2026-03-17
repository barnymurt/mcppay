// @ts-nocheck
import 'dotenv/config';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLedger, runMigrations, getAccount, getQuote, getReceipt, createQuote, createPayment, createReceipt, deductBalanceUsd, creditBalanceUsd, getTool, consumeQuote } from '@mcp-pg/ledger';
import { resolveRail } from '@mcp-pg/rails';
import { computeAuditHash } from '@mcp-pg/types';
import { getConfig } from './config.js';
import { v4 as uuid } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../../');
const config = getConfig();
const dbPath = path.resolve(projectRoot, config.LEDGER_DB_PATH);
console.log('DB Path:', dbPath);
const ledger = createLedger({ path: dbPath });
runMigrations(ledger);

const API_KEY = 'mpg_test_fyIs8o7kjD23tirFC-ZwAA';
const ACCOUNT_ID = '992c3cb0-b488-4ad4-a1f4-6cb1c2d1c38e';
const TOOL_ID = 'tool_8614b95c-bdc5-42f6-b0bd-6cfe24f3e594';

const sendJson = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const path = req.url.split('?')[0];
  const method = req.method;

  try {
    // GET /accounts/:id - Get balance
    if (method === 'GET' && path.match(/^\/accounts\/[\w-]+$/)) {
      const account = getAccount(ledger, ACCOUNT_ID);
      return sendJson(res, 200, { data: account, error: null });
    }

    // GET /tools/:id/quote - Get tool price (creates quote)
    if (method === 'POST' && path.match(/^\/tools\/.+\/quote$/)) {
      const body = await new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); });
      const { account_id } = JSON.parse(body);
      const toolId = path.split('/')[2];
      const tool = getTool(ledger, toolId);
      if (!tool) return sendJson(res, 404, { data: null, error: { code: 'TOOL_NOT_FOUND', message: 'Tool not found' } });
      
      const quote = createQuote(ledger, { account_id: ACCOUNT_ID, tool_id: toolId, amount_usd: tool.price_usd });
      return sendJson(res, 200, { data: quote, error: null });
    }

    // POST /payments - Pay for tool call
    if (method === 'POST' && path === '/payments') {
      const body = await new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); });
      const { quote_id } = JSON.parse(body);
      
      const quote = getQuote(ledger, quote_id);
      if (!quote) return sendJson(res, 404, { data: null, error: { code: 'QUOTE_NOT_FOUND', message: 'Quote not found' } });
      if (quote.consumed) return sendJson(res, 400, { data: null, error: { code: 'QUOTE_ALREADY_USED', message: 'Quote already used' } });
      if (new Date(quote.expires_at) < new Date()) return sendJson(res, 400, { data: null, error: { code: 'QUOTE_EXPIRED', message: 'Quote expired' } });
      
      const account = getAccount(ledger, ACCOUNT_ID);
      const newBalance = deductBalanceUsd(ledger, ACCOUNT_ID, quote.amount_usd);
      consumeQuote(ledger, quote_id);
      
      const paymentId = uuid();
      const receiptId = `receipt_${uuid()}`;
      const timestamp = new Date().toISOString();
      
      try {
        const payment = createPayment(ledger, { quote_id: quote.id, account_id: ACCOUNT_ID, amount_usd: quote.amount_usd, status: 'settled', rail: 'sandbox', receipt_id: receiptId });
        
        const auditHash = computeAuditHash({ payment_id: payment.id, tool_id: quote.tool_id, account_id: ACCOUNT_ID, amount_usd: quote.amount_usd, timestamp });
        const receipt = createReceipt(ledger, { payment_id: payment.id, tool_id: quote.tool_id, account_id: ACCOUNT_ID, amount_usd: quote.amount_usd, rail: 'sandbox', status: 'success', audit_hash: auditHash });
        console.log('Created receipt:', receipt.id);
        
        return sendJson(res, 200, { 
          data: { success: true, receipt_id: receipt.id, payment_id: payment.id, amount_usd_cents: quote.amount_usd, balance_remaining_usd_cents: newBalance, tool_id: quote.tool_id },
          error: null 
        });
      } catch (err) {
        console.error('Payment error:', err);
        return sendJson(res, 500, { data: null, error: { code: 'INTERNAL_ERROR', message: err.message } });
      }
    }

    // GET /receipts/:id - Get receipt
    if (method === 'GET' && path.match(/^\/receipts\/.+$/)) {
      const receiptId = path.split('/')[2];
      const receipt = getReceipt(ledger, receiptId);
      if (!receipt) return sendJson(res, 404, { data: null, error: { code: 'RECEIPT_NOT_FOUND', message: 'Receipt not found' } });
      return sendJson(res, 200, { data: receipt, error: null });
    }

    // POST /payments/authorize - authorize_and_pay
    if (method === 'POST' && path === '/payments/authorize') {
      const body = await new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); });
      const { tool_id } = JSON.parse(body);
      
      const tool = getTool(ledger, tool_id);
      if (!tool) return sendJson(res, 404, { data: null, error: { code: 'TOOL_NOT_FOUND', message: 'Tool not found' } });
      
      const quote = createQuote(ledger, { account_id: ACCOUNT_ID, tool_id, amount_usd: tool.price_usd });
      const newBalance = deductBalanceUsd(ledger, ACCOUNT_ID, quote.amount_usd);
      
      const receiptId = `receipt_${uuid()}`;
      const timestamp = new Date().toISOString();
      
      try {
        const payment = createPayment(ledger, { quote_id: quote.id, account_id: ACCOUNT_ID, amount_usd: quote.amount_usd, status: 'settled', rail: 'sandbox', receipt_id: receiptId });
        
        const auditHash = computeAuditHash({ payment_id: payment.id, tool_id, account_id: ACCOUNT_ID, amount_usd: quote.amount_usd, timestamp });
        createReceipt(ledger, { payment_id: payment.id, tool_id, account_id: ACCOUNT_ID, amount_usd: quote.amount_usd, rail: 'sandbox', status: 'success', audit_hash: auditHash });
        
        return sendJson(res, 200, { 
          data: { success: true, receipt_id: receiptId, payment_id: payment.id, amount_usd_cents: quote.amount_usd, balance_remaining_usd_cents: newBalance, tool_id },
          error: null 
        });
      } catch (err) {
        return sendJson(res, 500, { data: null, error: { code: 'INTERNAL_ERROR', message: err.message } });
      }
    }

    // Health check
    if (path === '/health') {
      return sendJson(res, 200, { status: 'ok' });
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    sendJson(res, 500, { error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

server.listen(3101, () => console.log('HTTP API running on http://localhost:3101'));
