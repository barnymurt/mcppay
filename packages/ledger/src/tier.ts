export type TierLevel = 0 | 1 | 2 | 3;

export interface TierConfig {
  tier1Usd: number;
  tier2Usd: number;
  tier3Usd: number;
  rateLimitMultiplier: number[];
  feeDiscountBps: number[];
  satchelDiscountBps: number[];
  fiatOffRampAccess: boolean[];
}

export const TIER_CONFIGS: Record<string, TierConfig> = {
  demo: {
    tier1Usd: 0.04,
    tier2Usd: 0.40,
    tier3Usd: 4.00,
    rateLimitMultiplier: [1, 10, 100, 1000],
    feeDiscountBps: [0, 50, 150, 250],
    satchelDiscountBps: [0, 200, 400, 600],
    fiatOffRampAccess: [false, true, true, true],
  },
  production: {
    tier1Usd: 50,
    tier2Usd: 200,
    tier3Usd: 1000,
    rateLimitMultiplier: [1, 10, 100, 1000],
    feeDiscountBps: [0, 100, 250, 500],
    satchelDiscountBps: [0, 300, 600, 900],
    fiatOffRampAccess: [false, true, true, true],
  },
};

export function getTierConfig(): TierConfig {
  const env = process.env.TIER_MODE === 'production' ? 'production' : 'demo';
  return TIER_CONFIGS[env];
}

export function computeTier(geroStakedUsd: number): TierLevel {
  const config = getTierConfig();
  if (geroStakedUsd >= config.tier3Usd) return 3;
  if (geroStakedUsd >= config.tier2Usd) return 2;
  if (geroStakedUsd >= config.tier1Usd) return 1;
  return 0;
}

export function computeStakedUsd(geroStaked: number, geroUsdRate: number): number {
  return geroStaked / 1_000_000 * geroUsdRate;
}

export function getNextTierThreshold(currentTier: TierLevel): number {
  const config = getTierConfig();
  switch (currentTier) {
    case 0: return config.tier1Usd;
    case 1: return config.tier2Usd;
    case 2: return config.tier3Usd;
    case 3: return 0;
  }
}

export function getCurrentDiscountBps(tier: TierLevel): number {
  const config = getTierConfig();
  return config.feeDiscountBps[tier];
}

export function getSatchelDiscountBps(tier: TierLevel): number {
  const config = getTierConfig();
  return config.satchelDiscountBps[tier];
}

export function getRateLimitMultiplier(tier: TierLevel): number {
  const config = getTierConfig();
  return config.rateLimitMultiplier[tier];
}

export function hasFiatOffRampAccess(tier: TierLevel): boolean {
  const config = getTierConfig();
  return config.fiatOffRampAccess[tier];
}
