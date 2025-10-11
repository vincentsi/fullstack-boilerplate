import { getRedis, isRedisAvailable } from '@/config/redis'

/**
 * Cache Service
 *
 * High-level caching API with:
 * - Automatic serialization/deserialization
 * - TTL (Time To Live) support
 * - Graceful degradation (works without Redis)
 * - Type-safe operations
 *
 * Usage:
 * ```typescript
 * // Set cache
 * await CacheService.set('user:123', userData, 3600) // 1 hour TTL
 *
 * // Get cache
 * const user = await CacheService.get<User>('user:123')
 *
 * // Delete cache
 * await CacheService.delete('user:123')
 * ```
 */
export class CacheService {
  /**
   * Set value in cache
   * @param key Cache key
   * @param value Value to cache (will be JSON stringified)
   * @param ttl Time to live in seconds (default: 1 hour)
   */
  static async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    if (!isRedisAvailable()) {
      return // Silently fail if Redis not available
    }

    try {
      const redis = getRedis()
      if (!redis) return

      const serialized = JSON.stringify(value)
      await redis.setex(key, ttl, serialized)
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error)
      // Don't throw - cache errors should not break the app
    }
  }

  /**
   * Get value from cache
   * @param key Cache key
   * @returns Cached value or null if not found
   */
  static async get<T = any>(key: string): Promise<T | null> {
    if (!isRedisAvailable()) {
      return null // Silently return null if Redis not available
    }

    try {
      const redis = getRedis()
      if (!redis) return null

      const cached = await redis.get(key)
      if (!cached) return null

      return JSON.parse(cached) as T
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error)
      return null // Return null on error
    }
  }

  /**
   * Delete value from cache
   * @param key Cache key
   */
  static async delete(key: string): Promise<void> {
    if (!isRedisAvailable()) {
      return
    }

    try {
      const redis = getRedis()
      if (!redis) return

      await redis.del(key)
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error)
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * @param pattern Pattern to match (e.g., "user:*")
   */
  static async deletePattern(pattern: string): Promise<void> {
    if (!isRedisAvailable()) {
      return
    }

    try {
      const redis = getRedis()
      if (!redis) return

      // Find all keys matching pattern
      const keys = await redis.keys(pattern)

      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (error) {
      console.error(`Cache delete pattern error for ${pattern}:`, error)
    }
  }

  /**
   * Check if key exists in cache
   * @param key Cache key
   */
  static async exists(key: string): Promise<boolean> {
    if (!isRedisAvailable()) {
      return false
    }

    try {
      const redis = getRedis()
      if (!redis) return false

      const result = await redis.exists(key)
      return result === 1
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error)
      return false
    }
  }

  /**
   * Increment a counter
   * Useful for rate limiting
   * @param key Counter key
   * @param ttl TTL in seconds (default: 1 hour)
   */
  static async increment(key: string, ttl: number = 3600): Promise<number> {
    if (!isRedisAvailable()) {
      return 0
    }

    try {
      const redis = getRedis()
      if (!redis) return 0

      const count = await redis.incr(key)

      // Set TTL only on first increment
      if (count === 1) {
        await redis.expire(key, ttl)
      }

      return count
    } catch (error) {
      console.error(`Cache increment error for key ${key}:`, error)
      return 0
    }
  }

  /**
   * Get TTL (time to live) of a key in seconds
   * @param key Cache key
   * @returns TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  static async getTTL(key: string): Promise<number> {
    if (!isRedisAvailable()) {
      return -2
    }

    try {
      const redis = getRedis()
      if (!redis) return -2

      return await redis.ttl(key)
    } catch (error) {
      console.error(`Cache getTTL error for key ${key}:`, error)
      return -2
    }
  }

  /**
   * Clear all cache (use with caution!)
   */
  static async clearAll(): Promise<void> {
    if (!isRedisAvailable()) {
      return
    }

    try {
      const redis = getRedis()
      if (!redis) return

      await redis.flushdb()
      console.log('✅ Cache cleared')
    } catch (error) {
      console.error('Cache clear all error:', error)
    }
  }

  /**
   * Get cache statistics
   */
  static async getStats() {
    if (!isRedisAvailable()) {
      return {
        available: false,
        keys: 0,
        memory: '0 B',
      }
    }

    try {
      const redis = getRedis()
      if (!redis) {
        return {
          available: false,
          keys: 0,
          memory: '0 B',
        }
      }

      const info = await redis.info('stats')
      const dbsize = await redis.dbsize()

      return {
        available: true,
        keys: dbsize,
        info,
      }
    } catch (error) {
      console.error('Cache stats error:', error)
      return {
        available: false,
        keys: 0,
        memory: '0 B',
      }
    }
  }
}

/**
 * Cache key builders
 * Centralize cache key naming for consistency
 */
export const CacheKeys = {
  // User cache
  user: (userId: string) => `user:${userId}`,
  userByEmail: (email: string) => `user:email:${email}`,

  // Subscription cache
  subscription: (userId: string) => `subscription:${userId}`,

  // Rate limit cache
  rateLimit: (identifier: string, endpoint: string) =>
    `ratelimit:${endpoint}:${identifier}`,

  // Session cache (optional)
  session: (sessionId: string) => `session:${sessionId}`,
} as const
