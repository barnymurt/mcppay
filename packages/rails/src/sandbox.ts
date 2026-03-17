import type { Account, Quote } from '@mcp-pg/types';
import { PaymentRail, type PaymentResult, type TopUpResult, type AppConfig } from './types.js';
import { creditBalanceUsd, creditBalanceGero } from '@mcp-pg/ledger';

export class SandboxRail implements PaymentRail {
  readonly name = 'sandbox' as const;

  constructor(_config?: AppConfig) {}

  async processPayment(_params: {
    quote: Quote;
    account: Account;
  }): Promise<PaymentResult> {
    return { status: 'settled' };
  }

  async initiateTopUp(params: {
    account: Account;
    amountCents: number;
    amountGero?: number;
  }): Promise<TopUpResult> {
    const { createLedger } = await import('@mcp-pg/ledger');
    const ledger = createLedger({ path: process.env.LEDGER_DB_PATH });
    
    let newBalanceCents: number | undefined;
    let newBalanceGero: number | undefined;

    if (params.amountCents > 0) {
      newBalanceCents = creditBalanceUsd(ledger, params.account.id, params.amountCents);
    }
    if (params.amountGero && params.amountGero > 0) {
      newBalanceGero = creditBalanceGero(ledger, params.account.id, params.amountGero);
    }

    return {
      status: 'completed',
      newBalanceCents,
      newBalanceGero,
    };
  }

  canHandle(_account: Account): boolean {
    return true;
  }
}
