// @ts-nocheck
import type { Quote, Receipt, Rail, ErrorCode } from '@mcp-pg/types';

export interface PaymentResult {
  success: boolean;
  receipt_id: string;
  payment_id: string;
  amount_usd_cents: number;
  amount_gero?: number;
  balance_remaining_usd_cents: number;
  tool_id: string;
}

export interface BalanceResult {
  account_id: string;
  balance_usd_cents: number;
  balance_gero: number;
  rail: Rail;
}

export interface TopUpResult {
  status: 'completed' | 'pending';
  new_balance_usd_cents?: number;
  new_balance_gero?: number;
  instructions?: Record<string, unknown>;
}

export class PaymentGatewayError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'PaymentGatewayError';
  }
}

export class PaymentGatewayClient {
  private baseUrl: string;
  private apiKey: string;
  private accountId: string;

  constructor(config: {
    baseUrl: string;
    apiKey: string;
    accountId: string;
  }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.accountId = config.accountId;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const envelope: any = await res.json();
    if (envelope.error) {
      throw new PaymentGatewayError(
        envelope.error.code,
        envelope.error.message,
        res.status
      );
    }
    return envelope.data as T;
  }

  async getToolPrice(toolId: string): Promise<Quote> {
    return this.request('POST', `/tools/${toolId}/quote`, { account_id: this.accountId });
  }

  async payForToolCall(quoteId: string): Promise<PaymentResult> {
    return this.request('POST', `/payments`, { quote_id: quoteId, account_id: this.accountId });
  }

  async getReceipt(receiptId: string): Promise<Receipt> {
    return this.request('GET', `/receipts/${receiptId}`);
  }

  async getBalance(): Promise<BalanceResult> {
    return this.request('GET', `/accounts/${this.accountId}`);
  }

  async topUp(amountCents: number, amountGero?: number, rail?: Rail): Promise<TopUpResult> {
    return this.request('POST', `/accounts/${this.accountId}/topup`, {
      amount_usd_cents: amountCents,
      amount_gero: amountGero,
      rail_override: rail,
    });
  }

  async authorizeAndPay(toolId: string): Promise<PaymentResult> {
    return this.request('POST', `/payments/authorize`, {
      tool_id: toolId,
      account_id: this.accountId,
    });
  }
}
