import { Ledger } from './database.js';
import { AppError, ErrorCode } from '@mcp-pg/types';

export function deductBalanceUsd(
  ledger: Ledger,
  accountId: string,
  amountCents: number
): number {
  return ledger.transaction(() => {
    const db = ledger.raw;
    
    const account = db.prepare(
      'SELECT balance_usd FROM accounts WHERE id = ?'
    ).get(accountId) as { balance_usd: number } | undefined;

    if (!account) {
      throw new AppError(ErrorCode.ACCOUNT_NOT_FOUND, `Account ${accountId} not found`);
    }

    if (account.balance_usd < amountCents) {
      throw new AppError(
        ErrorCode.INSUFFICIENT_BALANCE,
        `Balance ${account.balance_usd} < required ${amountCents}`,
        402,
        { balance: account.balance_usd, required: amountCents }
      );
    }

    const result = db.prepare(
      'UPDATE accounts SET balance_usd = balance_usd - ? WHERE id = ? AND balance_usd >= ?'
    ).run(amountCents, accountId, amountCents);

    if (result.changes !== 1) {
      throw new AppError(ErrorCode.INSUFFICIENT_BALANCE, 'Balance race condition — retry');
    }

    return account.balance_usd - amountCents;
  });
}

export function deductBalanceGero(
  ledger: Ledger,
  accountId: string,
  amountGero: number
): number {
  return ledger.transaction(() => {
    const db = ledger.raw;
    
    const account = db.prepare(
      'SELECT balance_gero FROM accounts WHERE id = ?'
    ).get(accountId) as { balance_gero: number } | undefined;

    if (!account) {
      throw new AppError(ErrorCode.ACCOUNT_NOT_FOUND, `Account ${accountId} not found`);
    }

    if (account.balance_gero < amountGero) {
      throw new AppError(
        ErrorCode.INSUFFICIENT_BALANCE,
        `GERO Balance ${account.balance_gero} < required ${amountGero}`,
        402,
        { balance_gero: account.balance_gero, required: amountGero }
      );
    }

    const result = db.prepare(
      'UPDATE accounts SET balance_gero = balance_gero - ? WHERE id = ? AND balance_gero >= ?'
    ).run(amountGero, accountId, amountGero);

    if (result.changes !== 1) {
      throw new AppError(ErrorCode.INSUFFICIENT_BALANCE, 'GERO balance race condition — retry');
    }

    return account.balance_gero - amountGero;
  });
}

export function creditBalanceUsd(
  ledger: Ledger,
  accountId: string,
  amountCents: number
): number {
  return ledger.transaction(() => {
    const db = ledger.raw;
    
    const account = db.prepare(
      'SELECT balance_usd FROM accounts WHERE id = ?'
    ).get(accountId) as { balance_usd: number } | undefined;

    if (!account) {
      throw new AppError(ErrorCode.ACCOUNT_NOT_FOUND, `Account ${accountId} not found`);
    }

    db.prepare(
      'UPDATE accounts SET balance_usd = balance_usd + ? WHERE id = ?'
    ).run(amountCents, accountId);

    return account.balance_usd + amountCents;
  });
}

export function creditBalanceGero(
  ledger: Ledger,
  accountId: string,
  amountGero: number
): number {
  return ledger.transaction(() => {
    const db = ledger.raw;
    
    const account = db.prepare(
      'SELECT balance_gero FROM accounts WHERE id = ?'
    ).get(accountId) as { balance_gero: number } | undefined;

    if (!account) {
      throw new AppError(ErrorCode.ACCOUNT_NOT_FOUND, `Account ${accountId} not found`);
    }

    db.prepare(
      'UPDATE accounts SET balance_gero = balance_gero + ? WHERE id = ?'
    ).run(amountGero, accountId);

    return account.balance_gero + amountGero;
  });
}
