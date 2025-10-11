import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { env } from '@/config/env'
import { registerSecurityMiddlewares } from '@/middlewares/security.middleware'
import { errorHandler } from '@/middlewares/error-handler.middleware'
import { csrfMiddleware } from '@/middlewares/csrf.middleware'
import { healthRoutes } from '@/routes/health.route'
import { authRoutes } from '@/routes/auth.route'
import { verificationRoutes } from '@/routes/verification.route'
import { passwordResetRoutes } from '@/routes/password-reset.route'
import { adminRoutes } from '@/routes/admin.route'
import { stripeRoutes } from '@/routes/stripe.route'
import { premiumRoutes } from '@/routes/premium.route'

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

  // Register Swagger/OpenAPI documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Fullstack Boilerplate API',
        description: 'Complete REST API with authentication, RBAC, Stripe subscriptions, and more',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3001',
          description: 'Development server',
        },
        {
          url: 'https://api.yourdomain.com',
          description: 'Production server',
        },
      ],
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'verification', description: 'Email verification endpoints' },
        { name: 'password-reset', description: 'Password reset endpoints' },
        { name: 'admin', description: 'Admin-only endpoints (requires ADMIN role)' },
        { name: 'stripe', description: 'Stripe subscription endpoints' },
        { name: 'premium', description: 'Premium feature endpoints (requires subscription)' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT access token obtained from /api/auth/login',
          },
        },
      },
    },
  })

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
  })

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
  await app.register(stripeRoutes, { prefix: '/api/stripe' })
  await app.register(premiumRoutes, { prefix: '/api/premium' })

  return app
}
