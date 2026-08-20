import type { Currency } from '@mcp-pg/types';
import { NexusClient } from './nexus-client.js';

const cache = new Map<string, { rate: number; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

export async function getUsdRate(
  currency: Currency,
  nexus?: NexusClient
): Promise<number> {
  if (currency === 'USD') return 1;

  const cached = cache.get(currency);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rate;
  }

  let rate: number;

  if (nexus) {
    try {
      const quote = await nexus.getDexQuote(currency, 'USD', 1_000_000);
      rate = quote.outputAmount / 1_000_000;
    } catch {
      rate = fallbackRates[currency] ?? 1;
    }
  } else {
    rate = fallbackRates[currency] ?? 1;
  }

  cache.set(currency, { rate, expiresAt: Date.now() + CACHE_TTL_MS });
  return rate;
}

export async function convertToUsd(
  amount: number,
  currency: Currency,
  nexus?: NexusClient
): Promise<number> {
  const rate = await getUsdRate(currency, nexus);
  return amount * rate;
}

export function clearPriceCache(): void {
  cache.clear();
}

const fallbackRates: Record<string, number> = {
  USD: 1,
  GERO: 0.05,
  BTC: 65000,
  ADA: 0.45,
};
