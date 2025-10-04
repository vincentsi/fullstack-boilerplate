import { createApp } from './app'
import { env } from '@/config/env'
import { disconnectPrisma } from '@/config/prisma'
import type { FastifyInstance } from 'fastify'

/**
 * Server entry point
 * 1. Validate environment variables (via env import)
 * 2. Create Fastify app
 * 3. Start listening on PORT
 * 4. Handle graceful shutdown
 */
let app: FastifyInstance | null = null

async function start() {
  try {
    // Create app
    app = await createApp()

    // Start server
    const port = Number(env.PORT)
    await app.listen({ port, host: '0.0.0.0' })

    console.log(`🚀 Server ready at http://localhost:${port}`)
    console.log(`📊 Health check: http://localhost:${port}/api/health`)
  } catch (error) {
    console.error('❌ Error starting server:', error)
    await cleanup()
    process.exit(1)
  }
}

/**
 * Cleanup resources before shutdown
 * Closes server and database connections
 */
async function cleanup() {
  try {
    if (app) {
      console.log('🔌 Closing server...')
      await app.close()
    }

    console.log('🔌 Closing database connection...')
    await disconnectPrisma()

    console.log('✅ Cleanup complete')
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
  }
}

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
