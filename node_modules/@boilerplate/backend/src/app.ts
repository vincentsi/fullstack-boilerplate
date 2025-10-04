import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { env } from '@/config/env'
import { registerSecurityMiddlewares } from '@/middlewares/security.middleware'
import { errorHandler } from '@/middlewares/error-handler.middleware'
import { healthRoutes } from '@/routes/health.route'
import { authRoutes } from '@/routes/auth.route'

/**
 * Create and configure Fastify application
 * Architecture :
 * 1. Initialize Fastify with logger
 * 2. Register security middlewares (Helmet, CORS, Rate Limit)
 * 3. Register error handler
 * 4. Register routes
 * 5. Return configured app
 */
export async function createApp(): Promise<FastifyInstance> {
  // Initialize Fastify with Pino logger
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  })

  // Register security middlewares
  await registerSecurityMiddlewares(app)

  // Register global error handler
  app.setErrorHandler(errorHandler)

  // Register routes
  await app.register(healthRoutes, { prefix: '/api' })
  await app.register(authRoutes, { prefix: '/api/auth' })

  return app
}
