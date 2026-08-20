import type { Account, Quote, Currency } from '@mcp-pg/types';
import { PaymentRail, type PaymentResult, type TopUpResult, type AppConfig } from './types.js';
import { creditBalanceBtc, deductBalanceBtc } from '@mcp-pg/ledger';

const BTC_SATOSHIS_PER_BTC = 100_000_000;
const DEFAULT_FEE_RATE_SAT_VB = 2;

export class BtcRail implements PaymentRail {
  readonly name = 'btc' as const;
  readonly supportedCurrencies = ['BTC'] as const;

  private config: AppConfig;
  private mempoolUrl: string;

  constructor(config: AppConfig) {
    this.config = config;
    this.mempoolUrl = config.MEMPOOL_API_URL || 'https://mempool.space/testnet/api';
  }

  async processPayment(params: {
    quote: Quote;
    account: Account;
    currency: Currency;
  }): Promise<PaymentResult> {
    const { quote, account, currency } = params;

    if (currency !== 'BTC') {
      throw new Error(`BtcRail only supports BTC, got ${currency}`);
    }

    const amountBtc = Number(quote.amount_btc || this.convertUsdToBtc(quote.amount_usd));

    const { createLedger } = await import('@mcp-pg/ledger');
    const ledger = createLedger({ path: process.env.LEDGER_DB_PATH });

    deductBalanceBtc(ledger, account.id, BigInt(amountBtc));

    if (process.env.MOCK_MODE === 'true') {
      return {
        status: 'settled',
        railTxId: `mock_btc_tx_${Date.now()}`,
      };
    }

    try {
      const txHash = await this.broadcastTransaction({
        toAddress: account.wallet_address || 'bcrt1mock',
        amountSatoshis: amountBtc,
        fromAddress: this.deriveChangeAddress(account.deposit_index || 0),
      });

      return {
        status: 'settled',
        railTxId: txHash,
      };
    } catch (error) {
      return {
        status: 'pending',
      };
    }
  }

  async initiateTopUp(params: {
    account: Account;
    amountCents: number;
    amountGero?: number;
    amountBtc?: number;
    currency?: Currency;
  }): Promise<TopUpResult> {
    const depositAddress = this.deriveDepositAddress(params.account.deposit_index || 0);
    const btcAmount = Number(params.amountBtc || this.convertUsdToBtc(params.amountCents));

    if (process.env.MOCK_MODE === 'true') {
      const { createLedger } = await import('@mcp-pg/ledger');
      const ledger = createLedger({ path: process.env.LEDGER_DB_PATH });
      creditBalanceBtc(ledger, params.account.id, BigInt(btcAmount));

      return {
        status: 'completed',
        newBalanceBtc: Number(btcAmount),
        instructions: {
          deposit_address: depositAddress,
          btc_amount: btcAmount.toString(),
          chain: 'bitcoin',
          network: this.config.IS_TESTNET ? 'testnet' : 'mainnet',
          rail: 'btc',
        },
      };
    }

    return {
      status: 'pending',
      newBalanceBtc: Number(btcAmount),
      instructions: {
        deposit_address: depositAddress,
        btc_amount: btcAmount.toString(),
        chain: 'bitcoin',
        network: this.config.IS_TESTNET ? 'testnet' : 'mainnet',
        rail: 'btc',
        qr_code: this.generateQrCode(depositAddress, btcAmount.toString()),
        expected_confirmations: 1,
      },
    };
  }

  canHandle(account: Account): boolean {
    return account.rail === 'btc' || 
           (!!account.wallet_address && account.rail !== 'sandbox');
  }

  private deriveDepositAddress(depositIndex: number): string {
    if (this.config.IS_TESTNET) {
      return `bcrt1${'1'.repeat(38 + (depositIndex % 10))}`;
    }
    return `bc1${'1'.repeat(38 + (depositIndex % 10))}`;
  }

  private deriveChangeAddress(_depositIndex: number): string {
    return this.deriveDepositAddress(999);
  }

  private convertUsdToBtc(usdCents: number): bigint {
    const btcPrice = this.getBtcPrice();
    const btcAmount = usdCents / 100 / btcPrice;
    return BigInt(Math.ceil(btcAmount * BTC_SATOSHIS_PER_BTC));
  }

  private getBtcPrice(): number {
    return 65000;
  }

  private generateQrCode(_address: string, _amount: string): string {
    return `bitcoin:${_address}?amount=${_amount}`;
  }

  private async broadcastTransaction(params: {
    toAddress: string;
    amountSatoshis: number;
    fromAddress: string;
  }): Promise<string> {
    const feeRate = await this.estimateFeeRate();
    const txHex = this.buildRawTransaction(params, feeRate);

    const response = await fetch(`${this.mempoolUrl}/tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: txHex,
    });

    if (!response.ok) {
      throw new Error(`Failed to broadcast: ${response.statusText}`);
    }

    return response.text();
  }

  private async estimateFeeRate(): Promise<number> {
    try {
      const response = await fetch(`${this.mempoolUrl}/fees/recommended`);
      if (response.ok) {
        const data = await response.json() as { hourFee?: number };
        return data.hourFee || DEFAULT_FEE_RATE_SAT_VB;
      }
    } catch {
      // Fallback to default
    }
    return DEFAULT_FEE_RATE_SAT_VB;
  }

  private buildRawTransaction(params: {
    toAddress: string;
    amountSatoshis: number;
    fromAddress: string;
  }, _feeRate: number): string {
    return `mock_tx_hex_${params.toAddress}_${params.amountSatoshis}`;
  }

  async getUtxos(address: string): Promise<Array<{ txId: string; index: number; value: number }>> {
    if (process.env.MOCK_MODE === 'true') {
      return [
        { txId: 'mock_utxo_1', index: 0, value: 50000 },
        { txId: 'mock_utxo_2', index: 1, value: 100000 },
      ];
    }

    const response = await fetch(`${this.mempoolUrl}/address/${address}/utxo`);
    if (!response.ok) {
      return [];
    }

    const data = await response.json() as Array<{ txid: string; vout: number; value: number }>;
    return data.map((utxo) => ({
      txId: utxo.txid,
      index: utxo.vout,
      value: utxo.value,
    }));
  }

  async getTransactionStatus(txHash: string): Promise<'pending' | 'confirmed' | 'failed'> {
    if (process.env.MOCK_MODE === 'true') {
      return 'confirmed';
    }

    const response = await fetch(`${this.mempoolUrl}/tx/${txHash}`);
    if (response.status === 404) {
      return 'pending';
    }
    if (!response.ok) {
      return 'failed';
    }

    const data = await response.json() as { status?: { confirmed?: boolean } };
    return data.status?.confirmed ? 'confirmed' : 'pending';
  }
}
