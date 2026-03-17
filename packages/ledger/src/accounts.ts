import { v4 as uuid } from 'uuid';
import { Ledger } from './database.js';
import type { Account, Rail } from '@mcp-pg/types';

export interface CreateAccountParams {
  name: string;
  rail?: Rail;
  balance_usd?: number;
  balance_gero?: number;
  wallet_address?: string;
}

export function createAccount(ledger: Ledger, params: CreateAccountParams): Account {
  const db = ledger.raw;
  const id = uuid();
  const now = new Date().toISOString();

  const maxIndex = db.prepare(
    'SELECT MAX(deposit_index) as max FROM accounts'
  ).get() as { max: number | null };
  const depositIndex = (maxIndex.max ?? -1) + 1;

  db.prepare(`
    INSERT INTO accounts (id, name, rail, balance_usd, balance_gero, wallet_address, deposit_index, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.name,
    params.rail || 'sandbox',
    params.balance_usd || 0,
    params.balance_gero || 0,
    params.wallet_address || null,
    depositIndex,
    now
  );

  return {
    id,
    name: params.name,
    rail: params.rail || 'sandbox',
    balance_usd: params.balance_usd || 0,
    balance_gero: params.balance_gero || 0,
    wallet_address: params.wallet_address,
    deposit_index: depositIndex,
    created_at: now,
  };
}

export function getAccount(ledger: Ledger, id: string): Account | undefined {
  const db = ledger.raw;
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any;
  if (!row) return undefined;

  return {
    id: row.id,
    name: row.name,
    rail: row.rail,
    balance_usd: row.balance_usd,
    balance_gero: row.balance_gero,
    wallet_address: row.wallet_address,
    deposit_index: row.deposit_index,
    created_at: row.created_at,
  };
}

export function getAccountByWalletAddress(ledger: Ledger, walletAddress: string): Account | undefined {
  const db = ledger.raw;
  const row = db.prepare('SELECT * FROM accounts WHERE wallet_address = ?').get(walletAddress) as any;
  if (!row) return undefined;

  return {
    id: row.id,
    name: row.name,
    rail: row.rail,
    balance_usd: row.balance_usd,
    balance_gero: row.balance_gero,
    wallet_address: row.wallet_address,
    deposit_index: row.deposit_index,
    created_at: row.created_at,
  };
}

export function updateAccountRail(ledger: Ledger, id: string, rail: Rail, walletAddress?: string): void {
  const db = ledger.raw;
  db.prepare('UPDATE accounts SET rail = ?, wallet_address = ? WHERE id = ?')
    .run(rail, walletAddress || null, id);
}
