import { v4 as uuid } from 'uuid';
import { Ledger } from './database.js';
import { getAccount } from './accounts.js';
import { deductBalanceGero, creditBalanceGero } from './balance.js';
import { computeTier, getTierConfig, type TierLevel } from './tier.js';

export interface StakeResult {
  oldTier: TierLevel;
  newTier: TierLevel;
  stakedUsd: number;
  tierImproved: boolean;
  amount: number;
}

export interface UnstakeRequestResult {
  availableAt: string;
  lockupHours: number;
  amount: number;
}

export interface StakeStatusResult {
  staked: number;
  stakedUsd: number;
  tier: TierLevel;
  nextTierThreshold: number;
  usdToNextTier: number;
  currentDiscountPercent: number;
  unstakePending: number;
  unstakeAvailableAt: string | null;
}

const LOCKUP_HOURS = 24;

export function stakeGero(
  ledger: Ledger,
  accountId: string,
  amount: number,
  geroUsdRate: number
): StakeResult {
  const db = ledger.raw;
  const account = getAccount(ledger, accountId);

  if (!account) {
    throw new Error('ACCOUNT_NOT_FOUND');
  }

  if (account.balance_gero < amount) {
    throw new Error('INSUFFICIENT_BALANCE');
  }

  const oldTier = (account.stake_tier || 0) as TierLevel;
  const newStaked = (account.gero_staked || 0) + amount;
  const newStakedUsd = newStaked / 1_000_000 * geroUsdRate;
  const newTier = computeTier(newStakedUsd);

  deductBalanceGero(ledger, accountId, BigInt(amount));

  db.prepare(`
    UPDATE accounts
    SET gero_staked = ?, gero_staked_usd_at_stake = ?, stake_tier = ?, staked_at = COALESCE(staked_at, ?)
    WHERE id = ?
  `).run(newStaked, newStakedUsd, newTier, new Date().toISOString(), accountId);

  db.prepare(`
    INSERT INTO stake_history (id, account_id, action, amount, tier_before, tier_after, timestamp)
    VALUES (?, ?, 'stake', ?, ?, ?, ?)
  `).run(
    uuid(),
    accountId,
    amount,
    oldTier,
    newTier,
    new Date().toISOString()
  );

  return {
    oldTier,
    newTier,
    stakedUsd: newStakedUsd,
    tierImproved: newTier > oldTier,
    amount,
  };
}

export function requestUnstake(
  ledger: Ledger,
  accountId: string,
  amount: number
): UnstakeRequestResult {
  const db = ledger.raw;
  const account = getAccount(ledger, accountId);

  if (!account) {
    throw new Error('ACCOUNT_NOT_FOUND');
  }

  if ((account.gero_staked || 0) < amount) {
    throw new Error('INSUFFICIENT_STAKED_BALANCE');
  }

  const availableAt = new Date(Date.now() + LOCKUP_HOURS * 60 * 60 * 1000).toISOString();

  db.prepare(`
    UPDATE accounts SET unstake_pending_at = ?, unstake_amount = ?
    WHERE id = ?
  `).run(availableAt, amount, accountId);

  db.prepare(`
    INSERT INTO stake_history (id, account_id, action, amount, tier_before, tier_after, timestamp)
    VALUES (?, ?, 'unstake_request', ?, ?, ?, ?)
  `).run(
    uuid(),
    accountId,
    amount,
    account.stake_tier,
    account.stake_tier,
    new Date().toISOString()
  );

  return {
    availableAt,
    lockupHours: LOCKUP_HOURS,
    amount,
  };
}

export function processUnstake(ledger: Ledger, accountId: string): { processed: boolean; amount: number } {
  const db = ledger.raw;
  const account = getAccount(ledger, accountId);

  if (!account) {
    throw new Error('ACCOUNT_NOT_FOUND');
  }

  const unstakePendingAt = account.unstake_pending_at;
  if (!unstakePendingAt) {
    return { processed: false, amount: 0 };
  }

  if (new Date(unstakePendingAt) > new Date()) {
    return { processed: false, amount: account.unstake_amount || 0 };
  }

  const amount = account.unstake_amount || 0;
  const oldTier = account.stake_tier || 0;
  const newStaked = Math.max(0, (account.gero_staked || 0) - amount);
  const geroUsdRate = 0.05;
  const newStakedUsd = newStaked / 1_000_000 * geroUsdRate;
  const newTier = computeTier(newStakedUsd);

  creditBalanceGero(ledger, accountId, BigInt(amount));

  db.prepare(`
    UPDATE accounts
    SET gero_staked = ?, gero_staked_usd_at_stake = ?, stake_tier = ?, unstake_pending_at = NULL, unstake_amount = 0
    WHERE id = ?
  `).run(newStaked, newStakedUsd, newTier, accountId);

  db.prepare(`
    INSERT INTO stake_history (id, account_id, action, amount, tier_before, tier_after, timestamp)
    VALUES (?, ?, 'unstake_complete', ?, ?, ?, ?)
  `).run(
    uuid(),
    accountId,
    amount,
    oldTier,
    newTier,
    new Date().toISOString()
  );

  return { processed: true, amount };
}

export function getStakeStatus(ledger: Ledger, accountId: string, geroUsdRate: number = 0.05): StakeStatusResult {
  const account = getAccount(ledger, accountId);

  if (!account) {
    throw new Error('ACCOUNT_NOT_FOUND');
  }

  const config = getTierConfig();
  const currentTier = (account.stake_tier || 0) as TierLevel;
  const staked = account.gero_staked || 0;
  const stakedUsd = account.gero_staked_usd_at_stake || (staked / 1_000_000 * geroUsdRate);

  let nextTierThreshold: number;
  let usdToNextTier: number;

  if (currentTier >= 3) {
    nextTierThreshold = 0;
    usdToNextTier = 0;
  } else {
    nextTierThreshold = currentTier === 0 ? config.tier1Usd :
                        currentTier === 1 ? config.tier2Usd :
                        config.tier3Usd;
    usdToNextTier = Math.max(0, nextTierThreshold - stakedUsd);
  }

  return {
    staked,
    stakedUsd,
    tier: currentTier,
    nextTierThreshold,
    usdToNextTier,
    currentDiscountPercent: config.feeDiscountBps[currentTier] / 100,
    unstakePending: account.unstake_amount || 0,
    unstakeAvailableAt: account.unstake_pending_at || null,
  };
}
