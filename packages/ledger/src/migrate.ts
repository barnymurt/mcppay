import fs from 'fs';
import path from 'path';
import { Ledger } from './database.js';

export function runMigrations(ledger: Ledger): void {
  const db = ledger.raw;
  const migrationsDir = ledger.getMigrationsPath();

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare('SELECT filename FROM _migrations').all().map((r: any) => r.filename)
  );

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)')
      .run(file, new Date().toISOString());
    console.log(`Applied migration: ${file}`);
  }
}
