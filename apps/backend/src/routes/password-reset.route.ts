import { FastifyInstance } from 'fastify'
import { PasswordResetController } from '../controllers/password-reset.controller'

/**
 * Routes de réinitialisation de mot de passe
 * Prefix: /api/auth
 */
export async function passwordResetRoutes(fastify: FastifyInstance) {
  const controller = new PasswordResetController()

  // POST /api/auth/forgot-password
  // Rate limit: 3 requests per hour (prevent abuse)
  fastify.post(
    '/forgot-password',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 hour',
        },
      },
    },
    controller.requestReset.bind(controller)
  )

  // POST /api/auth/reset-password
  // Rate limit: 5 requests per 15 minutes (prevent brute force)
  fastify.post(
    '/reset-password',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
        },
      },
    },
    controller.resetPassword.bind(controller)
  )
}
