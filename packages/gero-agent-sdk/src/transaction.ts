export interface TransactionBuilder {
  addInput(address: string, txId: string, index: number, amount: bigint): void;
  addOutput(address: string, amount: bigint): void;
  addMint(policyId: string, assetName: string, amount: bigint): void;
  setMetadata(metadata: Record<string, unknown>): void;
  setTtl(ttl: number): void;
  build(): Promise<Uint8Array>;
  toCbor(): string;
}

export interface TxOutput {
  address: string;
  amount: bigint;
  tokens?: Array<{
    policyId: string;
    assetName: string;
    amount: bigint;
  }>;
}

export interface TxInput {
  txId: string;
  index: number;
  address: string;
  amount: bigint;
}

export class CardanoTransactionBuilder implements TransactionBuilder {
  private inputs: TxInput[] = [];
  private outputs: TxOutput[] = [];
  private mint: Array<{ policyId: string; assetName: string; amount: bigint }> = [];
  private metadata?: Record<string, unknown>;
  private ttl?: number;
  private fee = 200000n;

  addInput(address: string, txId: string, index: number, amount: bigint): void {
    this.inputs.push({ txId, index, address, amount });
  }

  addOutput(address: string, amount: bigint): void {
    this.outputs.push({ address, amount });
  }

  addMint(policyId: string, assetName: string, amount: bigint): void {
    this.mint.push({ policyId, assetName, amount });
  }

  setMetadata(metadata: Record<string, unknown>): void {
    this.metadata = metadata;
  }

  setTtl(ttl: number): void {
    this.ttl = ttl;
  }

  async build(): Promise<Uint8Array> {
    const totalInput = this.inputs.reduce((sum, inp) => sum + inp.amount, 0n);
    const totalOutput = this.outputs.reduce((sum, out) => sum + out.amount, 0n);

    if (totalInput < totalOutput + this.fee) {
      throw new Error('Insufficient inputs for outputs + fee');
    }

    return new Uint8Array(64);
  }

  toCbor(): string {
    return 'mock_cbor_transaction';
  }

  getFee(): bigint {
    return this.fee;
  }

  getInputs(): TxInput[] {
    return [...this.inputs];
  }

  getOutputs(): TxOutput[] {
    return [...this.outputs];
  }

  getMints(): Array<{ policyId: string; assetName: string; amount: bigint }> {
    return [...this.mint];
  }
}

export async function buildSimplePayment(
  fromAddress: string,
  toAddress: string,
  amount: bigint
): Promise<CardanoTransactionBuilder> {
  const builder = new CardanoTransactionBuilder();
  
  const currentSlot = Math.floor(Date.now() / 1000) + 3600;
  builder.setTtl(currentSlot);

  builder.addOutput(toAddress, amount);

  return builder;
}

export async function buildTokenPayment(
  _fromAddress: string,
  toAddress: string,
  adaAmount: bigint,
  token: { policyId: string; assetName: string; amount: bigint }
): Promise<CardanoTransactionBuilder> {
  const builder = new CardanoTransactionBuilder();
  
  const currentSlot = Math.floor(Date.now() / 1000) + 3600;
  builder.setTtl(currentSlot);

  builder.addOutput(toAddress, adaAmount);
  builder.addMint(token.policyId, token.assetName, token.amount);

  return builder;
}
