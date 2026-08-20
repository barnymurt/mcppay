import type { GeroWalletConfig, BalanceInfo, TransactionResult, TokenInfo, PaymentParams } from './types.js';

export class GeroAgentWallet {
  private config: GeroWalletConfig;
  private address: string | null = null;

  constructor(config: GeroWalletConfig) {
    this.config = config;
  }

  async initialize(): Promise<string> {
    if (this.config.signingKey) {
      this.address = await this.deriveAddressFromKey(this.config.signingKey);
    } else if (this.config.mnemonic) {
      this.address = await this.deriveAddressFromMnemonic(this.config.mnemonic);
    } else {
      this.address = this.generateMockAddress();
    }
    return this.address;
  }

  getAddress(): string | null {
    return this.address;
  }

  async getBalance(): Promise<BalanceInfo> {
    if (!this.address) {
      throw new Error('Wallet not initialized');
    }

    if (process.env.MOCK_MODE === 'true') {
      return {
        balance: 1000000000n,
        available: 1000000000n,
        utxoCount: 1,
      };
    }

    const response = await fetch(
      `https://cardano-${this.config.network}.blockfrost.io/api/v0/addresses/${this.address}`,
      {
        headers: { 'project_id': this.config.blockfrostProjectId },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch balance: ${response.statusText}`);
    }

    const data = await response.json() as { balance_sum?: Array<{ quantity: string }>; amount?: Array<{ quantity: string }>; utxo_set?: unknown[] };
    return {
      balance: BigInt(data.balance_sum?.[0]?.quantity || 0),
      available: BigInt(data.amount?.[0]?.quantity || 0),
      utxoCount: data.utxo_set?.length || 0,
    };
  }

  async getTokens(): Promise<TokenInfo[]> {
    if (!this.address) {
      throw new Error('Wallet not initialized');
    }

    if (process.env.MOCK_MODE === 'true') {
      return [
        {
          policyId: 'a0028f350aa1c90900090a7d23f45d34b3c8d569b50c5c86872f4c82',
          assetName: 'GERO',
          quantity: 1000000n,
          fingerprint: 'asset1mock123',
        },
      ];
    }

    const response = await fetch(
      `https://cardano-${this.config.network}.blockfrost.io/api/v0/addresses/${this.address}/tokens`,
      {
        headers: { 'project_id': this.config.blockfrostProjectId },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch tokens: ${response.statusText}`);
    }

    const data = await response.json() as Array<{ policy_id: string; asset_name: string; quantity: number; fingerprint: string }>;
    return data
      .filter((t) => t.quantity > 0)
      .map((t) => ({
        policyId: t.policy_id,
        assetName: Buffer.from(t.asset_name, 'hex').toString('utf8'),
        quantity: BigInt(t.quantity),
        fingerprint: t.fingerprint,
      }));
  }

  async sendPayment(params: PaymentParams): Promise<TransactionResult> {
    if (!this.address) {
      throw new Error('Wallet not initialized');
    }

    if (process.env.MOCK_MODE === 'true') {
      return {
        txHash: `mock_tx_${Date.now()}`,
        status: 'confirmed',
        fee: 200000,
      };
    }

    const txBuilder = await this.createTransaction(params);
    const signedTx = await this.signTransaction(txBuilder);
    const txHash = await this.submitTransaction(signedTx);

    return {
      txHash,
      status: 'pending',
      fee: 200000,
    };
  }

  private async deriveAddressFromMnemonic(_mnemonic: string): Promise<string> {
    return this.generateMockAddress();
  }

  private async deriveAddressFromKey(_key: string): Promise<string> {
    return this.generateMockAddress();
  }

  private generateMockAddress(): string {
    if (this.config.network === 'preprod') {
      return `addr_test1${'1'.repeat(38)}`;
    }
    return `addr1${'1'.repeat(38)}`;
  }

  private async createTransaction(_params: PaymentParams): Promise<Uint8Array> {
    return new Uint8Array(32);
  }

  private async signTransaction(_tx: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(32);
  }

  private async submitTransaction(_signedTx: Uint8Array): Promise<string> {
    return `tx_${Date.now()}`;
  }
}
