import type { Account, Quote, Currency } from '@mcp-pg/types';
import { PaymentRail, type PaymentResult, type TopUpResult, type AppConfig } from './types.js';

export class Gerorail implements PaymentRail {
  readonly name = 'gerorail' as const;
  readonly supportedCurrencies = ['GERO'] as const;

  constructor(private config: AppConfig) {}

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
    const depositAddress = this.deriveDepositAddress(params.account.deposit_index || 0);
    const geroAmount = params.amountGero || this.convertUsdToGero(params.amountCents);

    return {
      status: 'pending',
      newBalanceGero: geroAmount,
      instructions: {
        deposit_address: depositAddress,
        gero_amount: geroAmount,
        chain: 'cardano',
        contract: this.config.GERO_CONTRACT_ADDRESS || 'gero_token_policy_id',
        rail: 'gerorail',
        network: this.config.IS_TESTNET ? 'preprod' : 'mainnet',
      },
    };
  }

  canHandle(account: Account): boolean {
    return account.rail === 'gerorail' || 
           (!!account.wallet_address && account.rail !== 'sandbox');
  }

  private deriveDepositAddress(depositIndex: number): string {
    return `addr_test${'1'.repeat(38 + (depositIndex % 10))}`;
  }

  private convertUsdToGero(usdCents: number): number {
    return Math.ceil(usdCents * 100);
  }
}
