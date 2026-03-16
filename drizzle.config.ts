import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  schema: path.join(__dirname, 'apps/api/src/db.ts'),
  out: path.join(__dirname, 'drizzle'),
  dialect: 'sqlite',
  dbCredentials: {
    url: path.join(__dirname, 'data/good-intent.db')
  }
});
