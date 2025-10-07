import { FastifyInstance } from 'fastify'
import { VerificationController } from '../controllers/verification.controller'

/**
 * Routes de vérification d'email
 * Prefix: /api/verification
 */
export async function verificationRoutes(fastify: FastifyInstance) {
  const controller = new VerificationController()

  // GET /api/verification/verify-email?token=xxx
  fastify.get('/verify-email', controller.verifyEmail.bind(controller))

  // POST /api/verification/resend-verification
  fastify.post('/resend-verification', controller.resendVerification.bind(controller))
}
