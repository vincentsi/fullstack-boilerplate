import { FastifyRequest, FastifyReply } from 'fastify'
import { PasswordResetService } from '../services/password-reset.service'

/**
 * Contrôleur pour la réinitialisation de mot de passe
 */
export class PasswordResetController {
  /**
   * Demande de réinitialisation de mot de passe
   * POST /api/auth/forgot-password
   * Body: { email: string }
   */
  async requestReset(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { email } = request.body as { email: string }

      if (!email) {
        return reply.status(400).send({
          success: false,
          error: 'Email requis',
        })
      }

      await PasswordResetService.requestReset(email)

      // Message intentionnellement vague pour la sécurité
      reply.send({
        success: true,
        message: 'Si cet email existe, un lien de réinitialisation a été envoyé',
      })
    } catch {
      // Ne pas révéler d'informations sensibles
      reply.status(500).send({
        success: false,
        error: 'Erreur serveur',
      })
    }
  }

  /**
   * Réinitialise le mot de passe avec un token
   * POST /api/auth/reset-password
   * Body: { token: string, password: string }
   */
  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { token, password } = request.body as {
        token: string
        password: string
      }

      if (!token || !password) {
        return reply.status(400).send({
          success: false,
          error: 'Token et mot de passe requis',
        })
      }

      await PasswordResetService.resetPassword(token, password)

      reply.send({
        success: true,
        message: 'Mot de passe réinitialisé avec succès',
      })
    } catch (error) {
      reply.status(400).send({
        success: false,
        error: (error as Error).message,
      })
    }
  }
}
