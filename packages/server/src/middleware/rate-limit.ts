import type { Request, Response, NextFunction } from 'express';
import { createLedger } from '@mcp-pg/ledger';

const DEFAULT_DAILY_LIMIT = 10;
const FUNDED_DAILY_LIMIT = 1000;

interface RateLimitEntry {
  requests: number;
  windowStart: number;
}

const ipCache = new Map<string, RateLimitEntry>();
const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface RateLimitOptions {
  dailyLimit?: number;
  windowMs?: number;
  keyGenerator?: (req: Request) => string;
}

export function rateLimitMiddleware(options: RateLimitOptions = {}) {
  const dailyLimit = options.dailyLimit ?? DEFAULT_DAILY_LIMIT;
  const windowMs = options.windowMs ?? WINDOW_MS;
  const keyGenerator = options.keyGenerator ?? ((req: Request) => req.ip || 'unknown');

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = keyGenerator(req);
    const now = Date.now();

    let entry = ipCache.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      entry = { requests: 0, windowStart: now };
      ipCache.set(key, entry);
    }

    entry.requests++;

    const accountId = req.headers['x-account-id'] as string | undefined;
    let effectiveLimit = dailyLimit;

    if (accountId) {
      try {
        const ledger = createLedger({ path: process.env.LEDGER_DB_PATH });
        const account = ledger.raw.prepare(
          'SELECT balance_usd FROM accounts WHERE id = ?'
        ).get(accountId) as { balance_usd: number } | undefined;

        if (account && account.balance_usd > 0) {
          effectiveLimit = FUNDED_DAILY_LIMIT;
        }
      } catch {
        // Continue with default limit if account lookup fails
      }
    }

    if (entry.requests > effectiveLimit) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Daily request limit of ${effectiveLimit} exceeded`,
        limit: effectiveLimit,
        resetAt: new Date(entry.windowStart + windowMs).toISOString(),
      });
      return;
    }

    res.setHeader('X-RateLimit-Limit', effectiveLimit.toString());
    res.setHeader('X-RateLimit-Remaining', (effectiveLimit - entry.requests).toString());
    res.setHeader('X-RateLimit-Reset', new Date(entry.windowStart + windowMs).toISOString());

    next();
  };
}

export function checkAccountRateLimit(
  accountId: string,
  ledger: ReturnType<typeof createLedger>
): { allowed: boolean; remaining: number; limit: number } {
  const db = ledger.raw;
  
  const today = new Date().toISOString().split('T')[0];
  
  let rateLimit = db.prepare(`
    SELECT requests_count, daily_limit, window_start
    FROM rate_limits
    WHERE account_id = ? AND DATE(window_start) = ?
  `).get(accountId, today) as { requests_count: number; daily_limit: number; window_start: string } | undefined;

  if (!rateLimit) {
    const defaultLimit = DEFAULT_DAILY_LIMIT;
    db.prepare(`
      INSERT INTO rate_limits (id, account_id, requests_count, daily_limit, window_start, created_at)
      VALUES (?, ?, 1, ?, ?, ?)
    `).run(
      `rl_${accountId}_${Date.now()}`,
      accountId,
      defaultLimit,
      new Date().toISOString(),
      new Date().toISOString()
    );

    return { allowed: true, remaining: defaultLimit - 1, limit: defaultLimit };
  }

  const remaining = rateLimit.daily_limit - rateLimit.requests_count;
  const allowed = remaining > 0;

  if (allowed) {
    db.prepare(`
      UPDATE rate_limits SET requests_count = requests_count + 1 WHERE account_id = ? AND DATE(window_start) = ?
    `).run(accountId, today);
  }

  return { allowed, remaining: Math.max(0, remaining), limit: rateLimit.daily_limit };
}

export function updateAccountDailyLimit(accountId: string, newLimit: number): void {
  const ledger = createLedger({ path: process.env.LEDGER_DB_PATH });
  const db = ledger.raw;

  const today = new Date().toISOString().split('T')[0];

  db.prepare(`
    UPDATE rate_limits SET daily_limit = ? WHERE account_id = ? AND DATE(window_start) = ?
  `).run(newLimit, accountId, today);
}
