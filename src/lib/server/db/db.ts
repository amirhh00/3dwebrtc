import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  // Replace with your PostgreSQL configuration
  // user: env.POSTGRES_USER,
  // host: env.POSTGRES_HOST,
  // database: env.POSTGRES_DB,
  // password: env.POSTGRES_PASSWORD,
  // port: Number(env.POSTGRES_PORT) || 5432 // Default PostgreSQL
  connectionString: env.POSTGRES_URL
});

export const db = drizzle({ client: pool, schema });
