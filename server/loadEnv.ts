/**
 * Carrega `.env` na raiz do projeto com override: valores do arquivo
 * vencem variáveis já herdadas do sistema (ex.: ADMIN_PASSWORD “fantasma” no Windows).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(__dirname, '../.env');

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile, override: true });
} else {
  dotenv.config({ override: true });
}
