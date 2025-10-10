import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import { env } from '@/config/env'
import { registerSecurityMiddlewares } from '@/middlewares/security.middleware'
import { errorHandler } from '@/middlewares/error-handler.middleware'
import { csrfMiddleware } from '@/middlewares/csrf.middleware'
import { healthRoutes } from '@/routes/health.route'
import { authRoutes } from '@/routes/auth.route'
import { verificationRoutes } from '@/routes/verification.route'
import { passwordResetRoutes } from '@/routes/password-reset.route'
import { adminRoutes } from '@/routes/admin.route'

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

  // Register cookie plugin
  await app.register(cookie)

  // Register security middlewares
  await registerSecurityMiddlewares(app)

  // Register CSRF protection middleware globally
  app.addHook('preHandler', csrfMiddleware)

  // Register global error handler
  app.setErrorHandler(errorHandler)

  // Register routes
  await app.register(healthRoutes, { prefix: '/api' })
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(passwordResetRoutes, { prefix: '/api/auth' })
  await app.register(verificationRoutes, { prefix: '/api/verification' })
  await app.register(adminRoutes, { prefix: '/api/admin' })

  return app
}
