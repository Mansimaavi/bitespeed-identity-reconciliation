import dotenv from 'dotenv';

dotenv.config();

/**
 * Environment configuration.
 * Uses dotenv for local development; Render injects env vars directly.
 */
export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
} as const;

if (!env.databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}
