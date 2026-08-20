import type { Account, Rail, Quote, Currency } from '@mcp-pg/types';

export interface PaymentResult {
  status: 'settled' | 'pending';
  railTxId?: string;
}

export interface TopUpResult {
  status: 'completed' | 'pending';
  newBalanceCents?: number;
  newBalanceGero?: number;
  newBalanceBtc?: number;
  instructions?: Record<string, unknown>;
}

export interface PaymentRail {
  readonly name: Rail;
  readonly supportedCurrencies: readonly Currency[];

  processPayment(params: {
    quote: Quote;
    account: Account;
    currency: Currency;
  }): Promise<PaymentResult>;

  initiateTopUp(params: {
    account: Account;
    amountCents: number;
    amountGero?: number;
    amountBtc?: number;
    currency?: Currency;
  }): Promise<TopUpResult>;

  canHandle(account: Account): boolean;
}

export interface AppConfig {
  PAYMENT_RAIL: Rail | 'auto';
  STRIPE_SECRET_KEY?: string;
  BLOCKFROST_PROJECT_ID?: string;
  BLOCKFROST_PREPROD_PROJECT_ID?: string;
  GERO_CONTRACT_ADDRESS?: string;
  BANK_API_URL?: string;
  BANK_API_KEY?: string;
  MEMPOOL_API_URL?: string;
  IS_TESTNET?: boolean;
  MCP_FEE_BPS?: number;
}
