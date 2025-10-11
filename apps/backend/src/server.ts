import { createApp } from './app'
import { env } from '@/config/env'
import { disconnectPrisma } from '@/config/prisma'
import { initializeRedis, disconnectRedis } from '@/config/redis'
import { CleanupService } from '@/services/cleanup.service'
import { BackupService } from '@/services/backup.service'
import { initializeSentry, captureException } from '@/config/sentry'
import type { FastifyInstance } from 'fastify'

/**
 * Server entry point
 * 1. Initialize Sentry for error tracking
 * 2. Initialize Redis for caching (optional)
 * 3. Validate environment variables (via env import)
 * 4. Create Fastify app
 * 5. Start listening on PORT
 * 6. Handle graceful shutdown
 */

// Initialize Sentry as early as possible
initializeSentry()

// Initialize Redis (optional, app works without it)
initializeRedis()

let app: FastifyInstance | null = null

async function start() {
  try {
    // Create app
    app = await createApp()

    // Start server
    const port = Number(env.PORT)
    await app.listen({ port, host: '0.0.0.0' })

    // Start automated cleanup job
    CleanupService.startCleanupJob(app)

    // Start automated backup job
    BackupService.startBackupJob(app)

    console.log(`🚀 Server ready at http://localhost:${port}`)
    console.log(`📊 Health check: http://localhost:${port}/api/health`)
    console.log(`📚 API Docs: http://localhost:${port}/docs`)
  } catch (error) {
    console.error('❌ Error starting server:', error)
    captureException(error as Error, { context: 'server-startup' })
    await cleanup()
    process.exit(1)
  }
}

/**
 * Cleanup resources before shutdown
 * Closes server, database, and Redis connections
 */
async function cleanup() {
  try {
    if (app) {
      console.log('🔌 Closing server...')
      await app.close()
    }

    console.log('🔌 Closing database connection...')
    await disconnectPrisma()

    console.log('🔌 Closing Redis connection...')
    await disconnectRedis()

    console.log('✅ Cleanup complete')
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection at:', promise)
  console.error('❌ Reason:', reason)

  // Send to Sentry
  captureException(reason as Error, {
    type: 'unhandledRejection',
    promise: String(promise),
  })

  // Ne pas crash le serveur, mais logger l'erreur
  // En production, vous pourriez vouloir crash et redémarrer via PM2/Docker
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)

  // Send to Sentry
  captureException(error, { type: 'uncaughtException' })

  // Cleanup et exit car l'état de l'app est incertain
  cleanup().then(() => {
    console.error('💥 Server crashed due to uncaught exception, exiting...')
    process.exit(1)
  })
})

// Handle graceful shutdown
const signals = ['SIGINT', 'SIGTERM'] as const
for (const signal of signals) {
  process.on(signal, async () => {
    console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`)
    await cleanup()
    process.exit(0)
  })
}

// Start server
start()
