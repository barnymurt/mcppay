import { Ledger } from './database.js';
import type { Currency } from '@mcp-pg/types';

export interface VolumeStats {
  totalVolumeUsd: number;
  totalVolumeGero: number;
  totalVolumeBtc: number;
  transactionCount: number;
  uniqueAccounts: number;
  uniqueTools: number;
}

export interface DailyVolume {
  date: string;
  volumeUsd: number;
  volumeGero: number;
  volumeBtc: number;
  transactionCount: number;
}

export interface ToolVolume {
  toolId: string;
  toolName: string;
  totalVolumeUsd: number;
  totalVolumeGero: number;
  totalVolumeBtc: number;
  transactionCount: number;
}

export interface PublicStats {
  lastUpdated: string;
  totalVolume: {
    usd: number;
    gero: number;
    btc: number;
  };
  dailyVolume: DailyVolume[];
  topTools: ToolVolume[];
  activeAccounts: number;
  totalTransactions: number;
}

export function getVolumeStats(ledger: Ledger, startDate?: string, endDate?: string): VolumeStats {
  const db = ledger.raw;

  let whereClause = "WHERE status = 'settled'";
  const params: string[] = [];

  if (startDate) {
    whereClause += ' AND created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    whereClause += ' AND created_at <= ?';
    params.push(endDate);
  }

  const volume = db.prepare(`
    SELECT 
      COALESCE(SUM(amount_usd), 0) as usd,
      COALESCE(SUM(amount_gero), 0) as gero,
      COALESCE(SUM(amount_btc), 0) as btc,
      COUNT(*) as count
    FROM payments ${whereClause}
  `).get(...params) as { usd: number; gero: number; btc: number; count: number };

  const accounts = db.prepare(`
    SELECT COUNT(DISTINCT account_id) as count FROM payments ${whereClause}
  `).get(...params) as { count: number };

  const tools = db.prepare(`
    SELECT COUNT(DISTINCT tool_id) FROM (
      SELECT tool_id FROM receipts ${whereClause.replace('payments', 'receipts')}
    )
  `).get() as { 'COUNT(DISTINCT tool_id)': number };

  return {
    totalVolumeUsd: volume.usd,
    totalVolumeGero: volume.gero,
    totalVolumeBtc: volume.btc,
    transactionCount: volume.count,
    uniqueAccounts: accounts.count,
    uniqueTools: tools['COUNT(DISTINCT tool_id)'],
  };
}

export function getDailyVolume(ledger: Ledger, days: number = 30): DailyVolume[] {
  const db = ledger.raw;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const results = db.prepare(`
    SELECT 
      DATE(created_at) as date,
      COALESCE(SUM(amount_usd), 0) as volume_usd,
      COALESCE(SUM(amount_gero), 0) as volume_gero,
      COALESCE(SUM(amount_btc), 0) as volume_btc,
      COUNT(*) as transaction_count
    FROM payments
    WHERE status = 'settled' AND created_at >= ?
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `).all(startDate.toISOString()) as DailyVolume[];

  return results;
}

export function getToolVolume(ledger: Ledger, limit: number = 10): ToolVolume[] {
  const db = ledger.raw;

  const results = db.prepare(`
    SELECT 
      r.tool_id as tool_id,
      t.name as tool_name,
      COALESCE(SUM(r.amount_usd), 0) as total_volume_usd,
      COALESCE(SUM(r.amount_gero), 0) as total_volume_gero,
      COALESCE(SUM(r.amount_btc), 0) as total_volume_btc,
      COUNT(r.id) as transaction_count
    FROM receipts r
    JOIN registered_tools t ON r.tool_id = t.id
    WHERE r.status = 'success'
    GROUP BY r.tool_id
    ORDER BY total_volume_usd DESC
    LIMIT ?
  `).all(limit) as ToolVolume[];

  return results;
}

export function getPublicStats(ledger: Ledger): PublicStats {
  const volume = getVolumeStats(ledger);
  const daily = getDailyVolume(ledger, 7);
  const topTools = getToolVolume(ledger, 5);

  const activeAccounts = ledger.raw.prepare(`
    SELECT COUNT(DISTINCT account_id) as count
    FROM payments
    WHERE created_at >= datetime('now', '-7 days')
  `).get() as { count: number };

  return {
    lastUpdated: new Date().toISOString(),
    totalVolume: {
      usd: volume.totalVolumeUsd,
      gero: volume.totalVolumeGero,
      btc: volume.totalVolumeBtc,
    },
    dailyVolume: daily,
    topTools,
    activeAccounts: activeAccounts.count,
    totalTransactions: volume.transactionCount,
  };
}

export function recordPaymentVolume(
  ledger: Ledger,
  paymentId: string,
  amountUsd: number,
  amountGero: number,
  amountBtc: number,
  currency: Currency
): void {
  const db = ledger.raw;

  db.prepare(`
    INSERT INTO payments (id, quote_id, account_id, amount_usd, amount_gero, amount_btc, currency, status, rail, receipt_id, created_at)
    VALUES (?, '', '', ?, ?, ?, ?, 'settled', 'sandbox', ?, ?)
  `).run(
    paymentId,
    amountUsd,
    amountGero || 0,
    amountBtc || 0,
    currency,
    `receipt_${paymentId}`,
    new Date().toISOString()
  );
}
