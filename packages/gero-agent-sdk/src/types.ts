export interface GeroWalletConfig {
  network: 'preprod' | 'mainnet';
  blockfrostProjectId: string;
  mnemonic?: string;
  signingKey?: string;
}

export interface TransactionResult {
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  fee?: number;
}

export interface BalanceInfo {
  balance: bigint;
  available: bigint;
  utxoCount: number;
}

export interface TokenInfo {
  policyId: string;
  assetName: string;
  quantity: bigint;
  fingerprint: string;
}

export interface PaymentParams {
  toAddress: string;
  amount: bigint;
  token?: TokenInfo;
  metadata?: Record<string, unknown>;
}
