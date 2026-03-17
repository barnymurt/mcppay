import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface DatabaseOptions {
  path?: string;
}

export class Ledger {
  private db: Database.Database;
  private migrationsPath: string;

  constructor(options: DatabaseOptions = {}) {
    const dbPath = options.path || process.env.LEDGER_DB_PATH || './data/ledger.db';
    const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
    
    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.migrationsPath = path.resolve(__dirname, '../../migrations');
  }

  get raw(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  getMigrationsPath(): string {
    return this.migrationsPath;
  }
}

export function createLedger(options?: DatabaseOptions): Ledger {
  return new Ledger(options);
}
