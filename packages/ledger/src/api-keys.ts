import { v4 as uuid } from 'uuid';
import { Ledger } from './database.js';
import type { ApiKey, ApiScope } from '@mcp-pg/types';

export interface CreateApiKeyParams {
  account_id: string;
  key_hash: string;
  prefix: string;
  name: string;
  scopes: ApiScope[];
}

export function createApiKey(ledger: Ledger, params: CreateApiKeyParams): ApiKey {
  const db = ledger.raw;
  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO api_keys (id, account_id, key_hash, prefix, name, scopes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.account_id,
    params.key_hash,
    params.prefix,
    params.name,
    JSON.stringify(params.scopes),
    now
  );

  return {
    id,
    account_id: params.account_id,
    key_hash: params.key_hash,
    prefix: params.prefix,
    name: params.name,
    scopes: params.scopes,
    created_at: now,
  };
}

export function getApiKeyByHash(ledger: Ledger, keyHash: string): ApiKey | undefined {
  const db = ledger.raw;
  const row = db.prepare(`
    SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL
  `).get(keyHash) as any;
  if (!row) return undefined;

  return {
    id: row.id,
    account_id: row.account_id,
    key_hash: row.key_hash,
    prefix: row.prefix,
    name: row.name,
    scopes: JSON.parse(row.scopes),
    created_at: row.created_at,
    last_used_at: row.last_used_at,
    revoked_at: row.revoked_at,
  };
}

export function touchApiKeyLastUsed(ledger: Ledger, keyId: string): void {
  const db = ledger.raw;
  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
    .run(new Date().toISOString(), keyId);
}

export function revokeApiKey(ledger: Ledger, keyId: string): void {
  const db = ledger.raw;
  db.prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ?')
    .run(new Date().toISOString(), keyId);
}

export function getApiKeysByAccount(ledger: Ledger, accountId: string): ApiKey[] {
  const db = ledger.raw;
  const rows = db.prepare(`
    SELECT * FROM api_keys WHERE account_id = ? AND revoked_at IS NULL
  `).all(accountId) as any[];

  return rows.map(row => ({
    id: row.id,
    account_id: row.account_id,
    key_hash: row.key_hash,
    prefix: row.prefix,
    name: row.name,
    scopes: JSON.parse(row.scopes),
    created_at: row.created_at,
    last_used_at: row.last_used_at,
  }));
}
