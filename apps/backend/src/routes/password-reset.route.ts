import { FastifyInstance } from 'fastify'
import { PasswordResetController } from '../controllers/password-reset.controller'

/**
 * Routes de réinitialisation de mot de passe
 * Prefix: /api/auth
 */
export async function passwordResetRoutes(fastify: FastifyInstance) {
  const controller = new PasswordResetController()

  // POST /api/auth/forgot-password
  fastify.post('/forgot-password', controller.requestReset.bind(controller))

  // POST /api/auth/reset-password
  fastify.post('/reset-password', controller.resetPassword.bind(controller))
}
