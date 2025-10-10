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
  // Rate limit: 3 requests per hour (prevent spam)
  fastify.post(
    '/resend-verification',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 hour',
        },
      },
    },
    controller.resendVerification.bind(controller)
  )
}
