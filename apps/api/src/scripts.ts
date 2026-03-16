import fs from 'node:fs';
import path from 'node:path';
import { getDbFilePath } from './db.js';
import { ensureInitialized, getDbStatus, resetDatabase } from './store.js';

function removeIfExists(filePath: string) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
}

function resetAndSeed() {
  resetDatabase();
  ensureInitialized();
  const status = getDbStatus();
  console.log(`Database reset and seeded at ${status.path}`);
}

function freshReset() {
  const dbPath = getDbFilePath();
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;

  removeIfExists(walPath);
  removeIfExists(shmPath);
  removeIfExists(dbPath);

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  ensureInitialized();
  console.log(`Fresh database created and seeded at ${dbPath}`);
}

const command = process.argv[2];

if (command === 'reset-seed') {
  resetAndSeed();
} else if (command === 'fresh-reset') {
  freshReset();
} else if (command === 'seed') {
  ensureInitialized();
  console.log(`Database initialized at ${getDbStatus().path}`);
} else {
  console.error('Usage: tsx src/scripts.ts <seed|reset-seed|fresh-reset>');
  process.exit(1);
}
