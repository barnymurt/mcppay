import { type Rail } from '@mcp-pg/types';
import { type AppConfig } from '@mcp-pg/rails';

export interface ServerConfig extends AppConfig {
  LEDGER_DB_PATH: string;
  MCP_SERVER_PORT: number;
  API_PORT: number;
  API_KEY_SALT: string;
  JWT_SECRET: string;
  JWT_EXPIRY: number;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
}

export function getConfig(): ServerConfig {
  return {
    PAYMENT_RAIL: (process.env.PAYMENT_RAIL as Rail | 'auto') || 'sandbox',
    API_KEY_SALT: process.env.API_KEY_SALT || 'default-salt-change-me',
    JWT_SECRET: process.env.JWT_SECRET || 'jwt-secret-change-me',
    JWT_EXPIRY: parseInt(process.env.JWT_EXPIRY || '900', 10),
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    BLOCKFROST_PROJECT_ID: process.env.BLOCKFROST_PROJECT_ID,
    BLOCKFROST_PREPROD_PROJECT_ID: process.env.BLOCKFROST_PREPROD_PROJECT_ID,
    GERO_CONTRACT_ADDRESS: process.env.GERO_CONTRACT_ADDRESS,
    BANK_API_URL: process.env.BANK_API_URL,
    BANK_API_KEY: process.env.BANK_API_KEY,
    IS_TESTNET: process.env.NODE_ENV !== 'production',
    LEDGER_DB_PATH: process.env.LEDGER_DB_PATH || './data/ledger.db',
    MCP_SERVER_PORT: parseInt(process.env.MCP_SERVER_PORT || '3100', 10),
    API_PORT: parseInt(process.env.API_PORT || '3101', 10),
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  };
}
