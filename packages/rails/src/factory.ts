import type { Account, Currency } from '@mcp-pg/types';
import type { PaymentRail, AppConfig } from './types.js';
import { SandboxRail } from './sandbox.js';
import { Gerorail } from './gerorail.js';
import { BtcRail } from './btc.js';

export function resolveRail(account: Account, config: AppConfig, currency?: Currency): PaymentRail {
  const explicitRail = config.PAYMENT_RAIL;
  
  if (explicitRail === 'sandbox' || explicitRail === 'auto') {
    if (account.rail === 'gerorail' || currency === 'GERO') {
      return new Gerorail(config);
    }
    if (account.rail === 'btc' || currency === 'BTC') {
      return new BtcRail(config);
    }
    if (account.rail === 'bank') {
      return new BankRail(config);
    }
  }

  if (explicitRail === 'gerorail' || account.rail === 'gerorail') {
    return new Gerorail(config);
  }

  if (explicitRail === 'btc' || account.rail === 'btc') {
    return new BtcRail(config);
  }

  if (explicitRail === 'bank' || account.rail === 'bank') {
    return new BankRail(config);
  }

  return new SandboxRail(config);
}

class BankRail implements PaymentRail {
  readonly name = 'bank' as const;
  readonly supportedCurrencies = ['USD'] as const;

  constructor(private config: AppConfig) {}

  async processPayment(_params: {
    quote: { amount_usd: number; amount_gero?: number; amount_btc?: number; currency: Currency };
    account: Account;
    currency: Currency;
  }): Promise<{ status: 'settled'; railTxId?: string }> {
    return { status: 'settled' };
  }

  async initiateTopUp(params: {
    account: Account;
    amountCents: number;
    amountGero?: number;
    amountBtc?: number;
    currency?: Currency;
  }): Promise<{ status: 'pending' | 'completed'; instructions?: Record<string, unknown> }> {
    return {
      status: 'pending',
      instructions: {
        bank_transfer: {
          iban: 'XX00 0000 0000 0000 00',
          bic: 'BANKXXXX',
          reference: `TOPUP-${params.account.id}`,
          amount_eur: (params.amountCents / 100).toFixed(2),
        },
        rail: 'bank',
      },
    };
  }

  canHandle(account: Account): boolean {
    return account.rail === 'bank' || this.config.BANK_API_URL !== undefined;
  }
}
