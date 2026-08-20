import type { GeroWalletConfig, BalanceInfo, TransactionResult, TokenInfo } from './types.js';

export interface MockConfig {
  initialBalance?: bigint;
  initialTokens?: TokenInfo[];
  network?: 'preprod' | 'mainnet';
}

export class MockGeroWallet {
  private address: string;
  private balance: bigint;
  private tokens: TokenInfo[];
  private transactions: Array<{
    to: string;
    amount: bigint;
    timestamp: number;
  }> = [];

  constructor(config: MockConfig = {}) {
    this.address = `addr_test1${'1'.repeat(38)}`;
    this.balance = config.initialBalance ?? 1000000000n;
    this.tokens = config.initialTokens ?? [
      {
        policyId: 'a0028f350aa1c90900090a7d23f45d34b3c8d569b50c5c86872f4c82',
        assetName: 'GERO',
        quantity: 1000000n,
        fingerprint: 'asset1mock123',
      },
    ];
  }

  async initialize(): Promise<string> {
    return this.address;
  }

  getAddress(): string {
    return this.address;
  }

  async getBalance(): Promise<BalanceInfo> {
    return {
      balance: this.balance,
      available: this.balance,
      utxoCount: 1,
    };
  }

  async getTokens(): Promise<TokenInfo[]> {
    return [...this.tokens];
  }

  async sendPayment(params: {
    toAddress: string;
    amount: bigint;
    token?: TokenInfo;
  }): Promise<TransactionResult> {
    this.transactions.push({
      to: params.toAddress,
      amount: params.amount,
      timestamp: Date.now(),
    });

    this.balance -= params.amount;

    return {
      txHash: `mock_tx_${Date.now()}`,
      status: 'confirmed',
      fee: 200000,
    };
  }

  addFunds(amount: bigint): void {
    this.balance += amount;
  }

  getTransactionHistory(): Array<{ to: string; amount: bigint; timestamp: number }> {
    return [...this.transactions];
  }

  static createTestWallet(network: 'preprod' | 'mainnet' = 'preprod'): MockGeroWallet {
    return new MockGeroWallet({ network });
  }

  static createTestWalletWithBalance(
    lovelace: bigint,
    geroTokens: bigint,
    network: 'preprod' | 'mainnet' = 'preprod'
  ): MockGeroWallet {
    return new MockGeroWallet({
      initialBalance: lovelace,
      initialTokens: [
        {
          policyId: 'a0028f350aa1c90900090a7d23f45d34b3c8d569b50c5c86872f4c82',
          assetName: 'GERO',
          quantity: geroTokens,
          fingerprint: 'asset1mock123',
        },
      ],
      network,
    });
  }
}
