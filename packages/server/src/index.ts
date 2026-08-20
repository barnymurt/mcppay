// @ts-nocheck
import path from 'path';
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLedger, runMigrations } from '@mcp-pg/ledger';
import { registerTools } from './tools/index.js';
import { getConfig } from './config.js';
import { createLogger } from './logger.js';

async function main() {
  const config = getConfig();
  const logger = createLogger('server');

  logger.info({ config: { ...config, API_KEY_SALT: '***', JWT_SECRET: '***' } }, 'Starting MCP Payment Gateway');

  const migrationsPath = process.env.MIGRATIONS_PATH || 'C:/Dev/MCPpay/migrations';
  const ledger = createLedger({
    path: config.LEDGER_DB_PATH,
    migrationsPath,
  });
  
  try {
    runMigrations(ledger);
    logger.info('Database migrations complete');
  } catch (error) {
    logger.error({ error }, 'Failed to run migrations');
    process.exit(1);
  }

  const server = new McpServer({
    name: 'mcp-payment-gateway',
    version: '0.1.0',
  }, { capabilities: {} });

  registerTools(server as any, ledger, config);

  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  logger.info('MCP server started on stdio');

  process.on('SIGTERM', () => {
    logger.info('Shutting down gracefully');
    ledger.close();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('Shutting down gracefully');
    ledger.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
