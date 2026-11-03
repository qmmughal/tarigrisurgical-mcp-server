import { z } from 'zod';

const envSchema = z.object({
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TARIGRI_SITE_ORIGIN: z.string().url().default('https://tarigrisurgical.com'),
  CATALOG_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(900),
  LOG_PRETTY: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
