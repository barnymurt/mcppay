import type { Account, Quote, Currency } from '@mcp-pg/types';
import { PaymentRail, type PaymentResult, type TopUpResult, type AppConfig } from './types.js';
import { creditBalanceUsd, creditBalanceGero, creditBalanceBtc } from '@mcp-pg/ledger';

export class SandboxRail implements PaymentRail {
  readonly name = 'sandbox' as const;
  readonly supportedCurrencies = ['USD', 'GERO', 'BTC'] as const;

  constructor(_config?: AppConfig) {}

  async processPayment(_params: {
    quote: Quote;
    account: Account;
    currency: Currency;
  }): Promise<PaymentResult> {
    return { status: 'settled' };
  }

  async initiateTopUp(params: {
    account: Account;
    amountCents: number;
    amountGero?: number;
    amountBtc?: number;
    currency?: Currency;
  }): Promise<TopUpResult> {
    const { createLedger } = await import('@mcp-pg/ledger');
    const ledger = createLedger({ path: process.env.LEDGER_DB_PATH });
    
    let newBalanceCents: number | undefined;
    let newBalanceGero: number | undefined;
    let newBalanceBtc: number | undefined;

    if (params.amountCents > 0) {
      newBalanceCents = creditBalanceUsd(ledger, params.account.id, params.amountCents);
    }
    if (params.amountGero && params.amountGero > 0) {
      newBalanceGero = Number(creditBalanceGero(ledger, params.account.id, BigInt(params.amountGero)));
    }
    if (params.amountBtc && params.amountBtc > 0) {
      newBalanceBtc = Number(creditBalanceBtc(ledger, params.account.id, BigInt(params.amountBtc)));
    }

    return {
      status: 'completed',
      newBalanceCents,
      newBalanceGero,
      newBalanceBtc,
    };
  }

  canHandle(_account: Account): boolean {
    return true;
  }
}
