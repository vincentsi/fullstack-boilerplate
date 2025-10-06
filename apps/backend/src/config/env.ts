import { z } from 'zod'
import { config } from 'dotenv'

// Load .env file
config()

/**
 * Schema de validation des variables d'environnement
 * Utilise Zod pour valider et typer les env vars au démarrage
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Server port
  PORT: z.string().default('3001'),

  // Database
  DATABASE_URL: z.string().url(),

  // JWT Secrets
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

  // Frontend URL for CORS
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
})

/**
 * Parse et valide les variables d'environnement
 * Throw une erreur si une variable est manquante ou invalide
 */
const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.format())
  process.exit(1)
}

/**
 * Variables d'environnement validées et typées
 * Validation fail-fast au démarrage de l'application
 *
 * @example
 * ```typescript
 * import { env } from '@/config/env'
 *
 * console.log(env.PORT)           // "3001" (string)
 * console.log(env.NODE_ENV)       // "development" | "production" | "test"
 * console.log(env.DATABASE_URL)   // "postgresql://..." (URL validée)
 * console.log(env.JWT_SECRET)     // Min 32 chars garanti par Zod
 * ```
 *
 * @example
 * ```bash
 * # .env file
 * NODE_ENV=development
 * PORT=3001
 * DATABASE_URL=postgresql://postgres:password@localhost:5432/mydb
 * JWT_SECRET=your-super-secret-key-min-32-chars
 * JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars
 * ```
 */
export const env = parsed.data
