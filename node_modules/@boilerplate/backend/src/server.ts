import { createApp } from './app'
import { env } from '@/config/env'

/**
 * Server entry point
 * 1. Validate environment variables (via env import)
 * 2. Create Fastify app
 * 3. Start listening on PORT
 * 4. Handle graceful shutdown
 */
async function start() {
  try {
    // Create app
    const app = await createApp()

    // Start server
    const port = Number(env.PORT)
    await app.listen({ port, host: '0.0.0.0' })

    console.log(`🚀 Server ready at http://localhost:${port}`)
    console.log(`📊 Health check: http://localhost:${port}/api/health`)
  } catch (error) {
    console.error('❌ Error starting server:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
const signals = ['SIGINT', 'SIGTERM'] as const
for (const signal of signals) {
  process.on(signal, async () => {
    console.log(`\n⚠️  Received ${signal}, closing server...`)
    process.exit(0)
  })
}

// Start server
start()
