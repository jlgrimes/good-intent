import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/better-sqlite3';
export { agentsTable, delegationEventsTable, delegationOrdersTable, delegationRunsTable, executionUpdatesTable, intentsTable, migrationsTable, routingDecisionsTable } from './schema.js';
import { agentsTable, delegationEventsTable, delegationOrdersTable, delegationRunsTable, executionUpdatesTable, intentsTable, migrationsTable, routingDecisionsTable } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DATA_DIR = path.join(REPO_ROOT, 'data');
const DEFAULT_DB_FILE = path.join(DATA_DIR, 'good-intent.db');

export function resolveDbFilePath(dbFilePath = process.env.GOOD_INTENT_DB_PATH) {
  return dbFilePath ? path.resolve(dbFilePath) : DEFAULT_DB_FILE;
}

export function ensureDbDirectory(dbFilePath = getDbFilePath()) {
  const dir = path.dirname(dbFilePath);
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDbFilePath() {
  return resolveDbFilePath();
}

export type GoodIntentDb = ReturnType<typeof createDatabase>;

export function createDatabase(dbFilePath = getDbFilePath()) {
  ensureDbDirectory(dbFilePath);
  const sqlite = new Database(dbFilePath);
  sqlite.pragma('journal_mode = WAL');
  const db = drizzle(sqlite);

  return {
    dbFilePath,
    sqlite,
    db
  };
}

let defaultDatabase: GoodIntentDb | null = null;

export function getDefaultDb() {
  if (!defaultDatabase) {
    defaultDatabase = createDatabase();
  }

  return defaultDatabase;
}

export function resetDefaultDbForTests() {
  if (defaultDatabase) {
    defaultDatabase.sqlite.close();
    defaultDatabase = null;
  }
}
