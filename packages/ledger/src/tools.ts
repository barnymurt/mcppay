import { v4 as uuid } from 'uuid';
import { Ledger } from './database.js';
import type { RegisteredTool } from '@mcp-pg/types';

export interface CreateToolParams {
  name: string;
  description: string;
  price_usd: number;
  price_gero?: number;
  owner_account_id: string;
}

export function createTool(ledger: Ledger, params: CreateToolParams): RegisteredTool {
  const db = ledger.raw;
  const id = `tool_${uuid()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO registered_tools (id, name, description, price_usd, price_gero, owner_account_id, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    id,
    params.name,
    params.description,
    params.price_usd,
    params.price_gero || null,
    params.owner_account_id,
    now
  );

  return {
    id,
    name: params.name,
    description: params.description,
    price_usd: params.price_usd,
    price_gero: params.price_gero,
    owner_account_id: params.owner_account_id,
    active: true,
    created_at: now,
  };
}

export function getTool(ledger: Ledger, id: string): RegisteredTool | undefined {
  const db = ledger.raw;
  const row = db.prepare('SELECT * FROM registered_tools WHERE id = ?').get(id) as any;
  if (!row) return undefined;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price_usd: row.price_usd,
    price_gero: row.price_gero,
    owner_account_id: row.owner_account_id,
    active: Boolean(row.active),
    created_at: row.created_at,
  };
}

export function getTools(ledger: Ledger, ownerAccountId?: string): RegisteredTool[] {
  const db = ledger.raw;
  
  let query = 'SELECT * FROM registered_tools WHERE active = 1';
  const params: any[] = [];

  if (ownerAccountId) {
    query += ' AND owner_account_id = ?';
    params.push(ownerAccountId);
  }

  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params) as any[];
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    price_usd: row.price_usd,
    price_gero: row.price_gero,
    owner_account_id: row.owner_account_id,
    active: Boolean(row.active),
    created_at: row.created_at,
  }));
}

export function deactivateTool(ledger: Ledger, id: string): void {
  const db = ledger.raw;
  db.prepare('UPDATE registered_tools SET active = 0 WHERE id = ?').run(id);
}
