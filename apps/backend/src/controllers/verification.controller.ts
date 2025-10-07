import { FastifyRequest, FastifyReply } from 'fastify'
import { VerificationService } from '../services/verification.service'

/**
 * Contrôleur pour la vérification d'email
 */
export class VerificationController {
  /**
   * Vérifie un email avec un token
   * GET /api/verification/verify-email?token=xxx
   */
  async verifyEmail(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { token } = request.query as { token: string }

      if (!token) {
        return reply.status(400).send({
          success: false,
          error: 'Token requis',
        })
      }

      const user = await VerificationService.verifyEmail(token)

      reply.send({
        success: true,
        message: 'Email vérifié avec succès',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
          },
        },
      })
    } catch (error) {
      reply.status(400).send({
        success: false,
        error: (error as Error).message,
      })
    }
  }

  /**
   * Renvoie un email de vérification
   * POST /api/verification/resend-verification
   * Body: { email: string }
   */
  async resendVerification(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { email } = request.body as { email: string }

      if (!email) {
        return reply.status(400).send({
          success: false,
          error: 'Email requis',
        })
      }

      await VerificationService.resendVerification(email)

      reply.send({
        success: true,
        message: 'Email de vérification renvoyé',
      })
    } catch (error) {
      reply.status(400).send({
        success: false,
        error: (error as Error).message,
      })
    }
  }
}
