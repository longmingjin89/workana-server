import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { logger } from '../core/logger.js';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5555', 10),
  database: process.env.POSTGRES_DB || 'workana',
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD || '',
});

pool.on('error', (err) => {
  logger.error(`DB pool error: ${err}`);
});

export async function initDb(): Promise<void> {
  const sql = readFileSync(resolve(process.cwd(), 'migrations/001_init.sql'), 'utf-8');
  await pool.query(sql);
  logger.info('DB initialized');
}

export { pool };
