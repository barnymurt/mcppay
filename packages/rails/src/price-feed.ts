import type { Currency } from '@mcp-pg/types';
import { NexusClient } from './nexus-client.js';

const cache = new Map<string, { rate: number; expiresAt: number; source: string }>();
const CACHE_TTL_MS = 30_000;

export interface PriceSource {
  source: 'nexus' | 'coingecko' | 'fallback';
  rate: number;
}

export async function getUsdRate(
  currency: Currency,
  nexus?: NexusClient | null
): Promise<PriceSource> {
  if (currency === 'USD') return { source: 'fallback', rate: 1 };

  const cached = cache.get(currency);
  if (cached && cached.expiresAt > Date.now()) {
    return { source: cached.source as PriceSource['source'], rate: cached.rate };
  }

  let rate: number;
  let source: PriceSource['source'] = 'fallback';

  if (nexus) {
    try {
      const quote = await nexus.getDexQuote(currency, 'USD', 1_000_000);
      rate = quote.outputAmount / 1_000_000;
      source = 'nexus';
      console.log(`[PriceFeed] ${currency}/USD from Nexus: $${rate}`);
    } catch (e) {
      console.warn(`[PriceFeed] Nexus unavailable for ${currency}, trying CoinGecko`);
      try {
        rate = await getCoingeckoRate(currency);
        source = 'coingecko';
        console.log(`[PriceFeed] ${currency}/USD from CoinGecko: $${rate}`);
      } catch {
        console.warn(`[PriceFeed] CoinGecko failed, using fallback for ${currency}`);
        rate = fallbackRates[currency] ?? 1;
      }
    }
  } else {
    try {
      rate = await getCoingeckoRate(currency);
      source = 'coingecko';
      console.log(`[PriceFeed] ${currency}/USD from CoinGecko: $${rate}`);
    } catch {
      console.warn(`[PriceFeed] All sources failed, using fallback for ${currency}`);
      rate = fallbackRates[currency] ?? 1;
    }
  }

  cache.set(currency, { rate, expiresAt: Date.now() + CACHE_TTL_MS, source });
  return { source, rate };
}

async function getCoingeckoRate(currency: Currency): Promise<number> {
  const coinGeckoIds: Record<string, string> = {
    GERO: 'gero-protocol',
    BTC: 'bitcoin',
    ADA: 'cardano',
    NIGHT: 'midnight-protocol',
  };

  const id = coinGeckoIds[currency];
  if (!id) throw new Error(`No CoinGecko ID for ${currency}`);

  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
    { headers: { 'Accept': 'application/json' } }
  );

  if (!response.ok) {
    throw new Error(`CoinGecko error: ${response.status}`);
  }

  const data = await response.json() as Record<string, { usd: number }>;
  const price = data[id]?.usd;
  if (!price) throw new Error(`No price for ${currency}`);
  return price;
}

export async function convertToUsd(
  amount: number,
  currency: Currency,
  nexus?: NexusClient | null
): Promise<{ usd: number; source: PriceSource['source'] }> {
  const { rate, source } = await getUsdRate(currency, nexus);
  return { usd: amount * rate, source };
}

export function clearPriceCache(): void {
  cache.clear();
}

export function getCachedRates(): Record<Currency, number> {
  const result: Record<string, number> = {};
  for (const [currency, data] of cache) {
    result[currency] = data.rate;
  }
  return result as Record<Currency, number>;
}

const fallbackRates: Record<string, number> = {
  USD: 1,
  GERO: 0.05,
  BTC: 65000,
  ADA: 0.45,
  NIGHT: 0.15,
};
