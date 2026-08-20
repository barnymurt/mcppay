import { Ledger } from './database.js';
import type { Currency } from '@mcp-pg/types';

const DEFAULT_FEE_BPS = 50;

export interface FeeCalculation {
  grossAmount: bigint;
  feeAmount: bigint;
  netAmount: bigint;
  feePercentage: number;
}

export function calculateFee(amount: bigint, feeBps: number = DEFAULT_FEE_BPS): FeeCalculation {
  const feeAmount = (amount * BigInt(feeBps)) / BigInt(10000);
  const netAmount = amount - feeAmount;
  const feePercentage = feeBps / 100;

  return {
    grossAmount: amount,
    feeAmount,
    netAmount,
    feePercentage,
  };
}

export function calculateFeeUsd(amountCents: number, feeBps: number = DEFAULT_FEE_BPS): FeeCalculation {
  return calculateFee(BigInt(amountCents), feeBps);
}

export function calculateFeeGero(amountLovelace: number, feeBps: number = DEFAULT_FEE_BPS): FeeCalculation {
  return calculateFee(BigInt(amountLovelace), feeBps);
}

export function calculateFeeBtc(amountSatoshis: number, feeBps: number = DEFAULT_FEE_BPS): FeeCalculation {
  return calculateFee(BigInt(amountSatoshis), feeBps);
}

export function recordMcpFee(
  ledger: Ledger,
  paymentId: string,
  amountGero: number,
  amountBtc: number,
  amountUsd: number,
  currency: Currency
): void {
  ledger.transaction(() => {
    const db = ledger.raw;
    
    db.prepare(`
      INSERT INTO mcp_revenue (id, payment_id, amount_gero, amount_btc, amount_usd, currency, collected_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `rev_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      paymentId,
      currency === 'GERO' ? amountGero : 0,
      currency === 'BTC' ? amountBtc : 0,
      currency === 'USD' ? amountUsd : 0,
      currency,
      new Date().toISOString()
    );
  });
}

export function getMcpFeeStats(ledger: Ledger): {
  totalRevenueGero: number;
  totalRevenueBtc: number;
  totalRevenueUsd: number;
  transactionCount: number;
} {
  const db = ledger.raw;

  const gero = db.prepare(`
    SELECT COALESCE(SUM(amount_gero), 0) as total FROM mcp_revenue WHERE amount_gero > 0
  `).get() as { total: number };

  const btc = db.prepare(`
    SELECT COALESCE(SUM(amount_btc), 0) as total FROM mcp_revenue WHERE amount_btc > 0
  `).get() as { total: number };

  const usd = db.prepare(`
    SELECT COALESCE(SUM(amount_usd), 0) as total FROM mcp_revenue WHERE amount_usd > 0
  `).get() as { total: number };

  const count = db.prepare(`
    SELECT COUNT(*) as count FROM mcp_revenue
  `).get() as { count: number };

  return {
    totalRevenueGero: gero.total,
    totalRevenueBtc: btc.total,
    totalRevenueUsd: usd.total,
    transactionCount: count.count,
  };
}

export function getMcpFeeByPeriod(
  ledger: Ledger,
  startDate: string,
  endDate: string
): Array<{ date: string; revenue: number; currency: Currency }> {
  const db = ledger.raw;

  const results = db.prepare(`
    SELECT 
      DATE(collected_at) as date,
      currency,
      SUM(amount_gero + amount_btc + amount_usd) as revenue
    FROM mcp_revenue
    WHERE collected_at BETWEEN ? AND ?
    GROUP BY DATE(collected_at), currency
    ORDER BY date DESC
  `).all(startDate, endDate) as Array<{ date: string; revenue: number; currency: Currency }>;

  return results;
}
