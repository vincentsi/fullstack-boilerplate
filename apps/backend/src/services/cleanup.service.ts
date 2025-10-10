import cron from 'node-cron'
import { prisma } from '@/config/prisma'
import type { FastifyInstance } from 'fastify'

/**
 * Service de nettoyage automatique des tokens expirés
 * Exécution quotidienne à 3h du matin
 */
export class CleanupService {
  /**
   * Supprime tous les tokens expirés de la base de données
   * - RefreshTokens expirés
   * - VerificationTokens expirés
   * - PasswordResetTokens expirés
   * - CsrfTokens expirés
   */
  static async cleanupExpiredTokens(): Promise<void> {
    const now = new Date()

    try {
      // Supprimer les refresh tokens expirés
      const deletedRefreshTokens = await prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      })

      // Supprimer les verification tokens expirés
      const deletedVerificationTokens = await prisma.verificationToken.deleteMany(
        {
          where: {
            expiresAt: {
              lt: now,
            },
          },
        }
      )

      // Supprimer les password reset tokens expirés
      const deletedResetTokens = await prisma.passwordResetToken.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      })

      // Supprimer les CSRF tokens expirés
      const deletedCsrfTokens = await prisma.csrfToken.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      })

      console.log(
        `✅ Cleanup completed: ${deletedRefreshTokens.count} refresh tokens, ${deletedVerificationTokens.count} verification tokens, ${deletedResetTokens.count} reset tokens, ${deletedCsrfTokens.count} CSRF tokens deleted`
      )
    } catch (error) {
      console.error('❌ Error during token cleanup:', error)
    }
  }

  /**
   * Démarre le cron job de nettoyage
   * Exécution tous les jours à 3h du matin
   * @param app - Instance Fastify pour le logging
   */
  static startCleanupJob(app: FastifyInstance): void {
    // Cron: Tous les jours à 3h00 (heure creuse)
    cron.schedule('0 3 * * *', async () => {
      app.log.info('Starting scheduled token cleanup...')
      await CleanupService.cleanupExpiredTokens()
    })

    app.log.info('✅ Token cleanup job scheduled (daily at 3:00 AM)')
  }

  /**
   * Exécute un nettoyage manuel immédiat
   * Utile pour les tests ou nettoyage ponctuel
   */
  static async runManualCleanup(app: FastifyInstance): Promise<void> {
    app.log.info('Running manual token cleanup...')
    await CleanupService.cleanupExpiredTokens()
  }
}
