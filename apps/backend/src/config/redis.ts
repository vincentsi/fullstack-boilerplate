import Redis from 'ioredis'

/**
 * Redis Client Configuration
 *
 * Redis is used for:
 * - Caching user data (reduce DB queries)
 * - Caching subscription status
 * - Rate limiting counters (optional, faster than DB)
 * - Session storage (optional)
 *
 * Features:
 * - Auto-reconnection
 * - Connection pooling
 * - Error handling
 * - Optional (app works without Redis)
 */

let redisClient: Redis | null = null

/**
 * Initialize Redis connection
 * Returns null if Redis not configured (app continues without cache)
 */
export function initializeRedis(): Redis | null {
  const redisUrl = process.env.REDIS_URL

  // Redis is optional - app works without it
  if (!redisUrl) {
    console.log('⚠️  Redis URL not configured - caching disabled')
    return null
  }

  try {
    redisClient = new Redis(redisUrl, {
      // Retry strategy
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000)
        return delay
      },

      // Reconnect on error
      reconnectOnError(err) {
        const targetError = 'READONLY'
        if (err.message.includes(targetError)) {
          // Only reconnect when the error contains "READONLY"
          return true
        }
        return false
      },

      // Timeout
      connectTimeout: 10000,
      commandTimeout: 5000,

      // Auto pipelining for better performance
      enableAutoPipelining: true,
    })

    // Connection success
    redisClient.on('connect', () => {
      console.log('✅ Redis connected')
    })

    // Connection error
    redisClient.on('error', (err) => {
      console.error('❌ Redis error:', err.message)

      // Report to Sentry if available
      if (process.env.SENTRY_DSN) {
        import('@/config/sentry').then(({ captureException }) => {
          captureException(err, { context: 'redis-connection' })
        })
      }
    })

    // Disconnection
    redisClient.on('close', () => {
      console.log('🔌 Redis disconnected')
    })

    return redisClient
  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error)
    return null
  }
}

/**
 * Get Redis client
 * Returns null if Redis not available
 */
export function getRedis(): Redis | null {
  return redisClient
}

/**
 * Disconnect Redis
 * Call this on server shutdown
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    console.log('✅ Redis disconnected')
  }
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redisClient !== null && redisClient.status === 'ready'
}

export { redisClient }
