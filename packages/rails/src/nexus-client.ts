export interface NexusConfig {
  apiKey: string;
  baseUrl: string;
}

export interface TransferParams {
  fromAddress: string;
  toAddress: string;
  amount: string;
  asset: string;
}

export interface SwapParams {
  fromAddress: string;
  fromAsset: string;
  toAsset: string;
  amount: string;
}

export interface DexQuote {
  fromToken: string;
  toToken: string;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  feeBps: number;
}

export class NexusClient {
  constructor(private config: NexusConfig) {}

  async getLatestBlock(): Promise<any> {
    return this.request('/blocks/latest');
  }

  async getAddress(address: string): Promise<any> {
    return this.request(`/addresses/${address}`);
  }

  async getUtxos(address: string): Promise<any[]> {
    return this.request(`/addresses/${address}/utxos`);
  }

  async submitTx(signedCbor: string): Promise<{ txHash: string }> {
    return this.request('/transactions/submit', {
      method: 'POST',
      body: JSON.stringify({ cbor: signedCbor }),
    });
  }

  async buildTransfer(params: TransferParams): Promise<{ cbor: string; fee: number }> {
    return this.request('/tx/transfer', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async buildSwap(params: SwapParams): Promise<{ cbor: string; fee: number; outputAmount: number }> {
    return this.request('/tx/swap', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getDexQuote(fromToken: string, toToken: string, amount: number): Promise<DexQuote> {
    return this.request(`/dex/quotes?from=${fromToken}&to=${toToken}&amount=${amount}`);
  }

  async getBtcAddress(address: string): Promise<any> {
    return this.request(`/btc/addresses/${address}`);
  }

  async getBtcTransaction(txid: string): Promise<any> {
    return this.request(`/btc/transactions/${txid}`);
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.config.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'X-Api-Key': this.config.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 402) {
      throw new Error(`Nexus add-on required for ${path}`);
    }

    if (!response.ok) {
      throw new Error(`Nexus ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }
}

export function createNexusClient(apiKey?: string): NexusClient | null {
  const key = apiKey || process.env.NEXUS_API_KEY;
  if (!key) return null;

  return new NexusClient({
    apiKey: key,
    baseUrl: process.env.NEXUS_BASE_URL || 'https://nexus.gerowallet.io/api',
  });
}
