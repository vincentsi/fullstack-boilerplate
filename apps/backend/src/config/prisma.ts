import { PrismaClient } from '@prisma/client'
import { env } from '@/config/env'

/**
 * PrismaClient Singleton
 * Prevents multiple instances and connection pool exhaustion
 *
 * In development, prevents hot-reload from creating new instances
 * In production, ensures single client instance across the app
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

/**
 * Create PrismaClient with connection pooling configuration
 */
export const prisma =
  global.prisma ||
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  })

// In development, preserve instance across hot reloads
if (env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

/**
 * Graceful shutdown handler
 * Ensures connections are properly closed when app terminates
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect()
}
