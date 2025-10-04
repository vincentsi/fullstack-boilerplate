import type { FastifyInstance } from 'fastify'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { env } from '@/config/env'

/**
 * Configure security middlewares for Fastify
 * - Helmet: Security headers
 * - CORS: Cross-Origin Resource Sharing
 * - Rate Limiting: Prevent abuse
 */
export async function registerSecurityMiddlewares(
  app: FastifyInstance
): Promise<void> {
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
        : true, // Allow all origins in dev
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
