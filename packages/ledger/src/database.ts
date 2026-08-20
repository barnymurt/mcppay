import path from 'path';
import { createRequire } from 'module';

const require2 = createRequire(import.meta.url);

export interface DatabaseOptions {
  path?: string;
  migrationsPath?: string;
}

export class Ledger {
  private db: any;
  private migrationsPath: string;

  constructor(options: DatabaseOptions = {}) {
    const Database = require2('better-sqlite3');
    const dbPath = options.path || process.env.LEDGER_DB_PATH || './data/ledger.db';
    const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);

    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrationsPath = options.migrationsPath || path.resolve(process.cwd(), 'migrations');
  }

  get raw(): any {
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

export function runMigrations(ledger: Ledger): void {
  const db = ledger.raw;
  const migrationsDir = ledger.getMigrationsPath();
  const fs = require2('fs');

  db.prepare('PRAGMA foreign_keys = ON').run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    )
  `).run();

  const applied = new Set(
    db.prepare('SELECT filename FROM _migrations').all().map((r: any) => r.filename)
  );

  const files = fs.readdirSync(migrationsDir)
    .filter((f: string) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const statements = sql.split(';').filter((s: string) => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) db.prepare(stmt).run();
    }
    
    db.prepare('INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)')
      .run(file, new Date().toISOString());
    console.log(`Applied migration: ${file}`);
  }
}
