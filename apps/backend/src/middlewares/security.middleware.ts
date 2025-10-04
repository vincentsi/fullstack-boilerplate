import type { FastifyInstance } from 'fastify'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import compress from '@fastify/compress'
import { env } from '@/config/env'

/**
 * Configure security middlewares for Fastify
 * - Helmet: Security headers
 * - CORS: Cross-Origin Resource Sharing
 * - Rate Limiting: Prevent abuse
 * - Compression: Gzip/Brotli responses
 */
export async function registerSecurityMiddlewares(
  app: FastifyInstance
): Promise<void> {
  // Compression - Gzip/Brotli
  await app.register(compress, {
    global: true,
    threshold: 1024, // Compress responses > 1KB
  })

  // Helmet - Security headers
  await app.register(helmet, {
    // Permet les inline scripts en dev (Next.js, etc.)
    contentSecurityPolicy: env.NODE_ENV === 'production',
  })

  // CORS - Allow frontend to communicate with backend
  await app.register(cors, {
    origin:
      env.NODE_ENV === 'production'
        ? ['https://your-production-domain.com'] // Remplacer en production
        : ['http://localhost:3000', 'http://localhost:3001'], // URLs frontend en dev
    credentials: true, // Allow cookies
  })

  // Rate Limiting - Prevent DDoS/brute force
  await app.register(rateLimit, {
    max: 100, // Max 100 requests
    timeWindow: '15 minutes', // Par window de 15 min
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded, please try again later.',
    }),
  })
}
