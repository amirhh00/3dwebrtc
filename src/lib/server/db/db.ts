import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import postgres from 'postgres';

export const postgresClient = postgres(env.POSTGRES_URL);
export const db = drizzle(postgresClient, { schema });
