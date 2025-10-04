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
 * Export des variables d'environnement validées et typées
 *
 * Usage:
 * import { env } from '@/config/env'
 * console.log(env.PORT) // TypeScript sait que c'est un string
 */
export const env = parsed.data
