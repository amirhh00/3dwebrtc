import { Pool } from 'pg';
import { env } from '$env/dynamic/private';

const pool = new Pool({
  // Replace with your PostgreSQL configuration
  user: env.POSTGRES_USER,
  host: env.POSTGRES_HOST,
  database: env.POSTGRES_DB,
  password: env.POSTGRES_PASSWORD,
  port: Number(env.POSTGRES_PORT) || 5432, // Default PostgreSQL
});

export default pool;