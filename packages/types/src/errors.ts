export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_API_KEY = 'INVALID_API_KEY',

  QUOTE_NOT_FOUND = 'QUOTE_NOT_FOUND',
  QUOTE_EXPIRED = 'QUOTE_EXPIRED',
  QUOTE_ALREADY_USED = 'QUOTE_ALREADY_USED',
  QUOTE_ACCOUNT_MISMATCH = 'QUOTE_ACCOUNT_MISMATCH',

  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  PAYMENT_FAILED = 'PAYMENT_FAILED',

  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_INACTIVE = 'TOOL_INACTIVE',
  RECEIPT_NOT_FOUND = 'RECEIPT_NOT_FOUND',

  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_AMOUNT = 'INVALID_AMOUNT',

  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RAIL_UNAVAILABLE = 'RAIL_UNAVAILABLE',
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}
