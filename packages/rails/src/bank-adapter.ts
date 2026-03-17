export interface TransferParams {
  amount: number;
  currency: 'EUR' | 'USD' | 'ADA' | 'BTC';
  destinationAccount: string;
  reference?: string;
}

export interface TransferResult {
  transferId: string;
  status: 'pending' | 'completed' | 'failed';
  estimatedSettlement?: string;
}

export interface BankBalance {
  currency: 'EUR' | 'USD' | 'ADA' | 'BTC';
  available: number;
  pending: number;
}

export interface WebhookPayload {
  eventType: string;
  transferId: string;
  status: 'completed' | 'failed';
  amount: number;
  currency: string;
  timestamp: string;
  signature?: string;
}

export interface BankAdapter {
  createTransfer(params: TransferParams): Promise<TransferResult>;
  getBalance(accountId: string, currency: 'EUR' | 'USD' | 'ADA' | 'BTC'): Promise<BankBalance>;
  handleWebhook(payload: WebhookPayload): Promise<void>;
}

export class MockBankAdapter implements BankAdapter {
  async createTransfer(_params: TransferParams): Promise<TransferResult> {
    return {
      transferId: `mock_${Date.now()}`,
      status: 'completed',
      estimatedSettlement: new Date().toISOString(),
    };
  }

  async getBalance(_accountId: string, currency: 'EUR' | 'USD' | 'ADA' | 'BTC'): Promise<BankBalance> {
    return {
      currency,
      available: 1000000,
      pending: 0,
    };
  }

  async handleWebhook(_payload: WebhookPayload): Promise<void> {
    // No-op for mock
  }
}
