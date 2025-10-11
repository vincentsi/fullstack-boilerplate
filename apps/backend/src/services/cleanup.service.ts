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
   *
   * Optimisé avec batching pour éviter les locks prolongés sur la DB
   */
  static async cleanupExpiredTokens(): Promise<void> {
    const now = new Date()
    const BATCH_SIZE = 1000 // Supprimer par lots de 1000

    try {
      // Cleanup refresh tokens avec batching
      const deletedRefreshTokens = await this.cleanupModelWithBatching(
        'refresh tokens',
        prisma.refreshToken,
        now,
        BATCH_SIZE
      )

      // Cleanup verification tokens avec batching
      const deletedVerificationTokens = await this.cleanupModelWithBatching(
        'verification tokens',
        prisma.verificationToken,
        now,
        BATCH_SIZE
      )

      // Cleanup password reset tokens avec batching
      const deletedResetTokens = await this.cleanupModelWithBatching(
        'password reset tokens',
        prisma.passwordResetToken,
        now,
        BATCH_SIZE
      )

      // Cleanup CSRF tokens avec batching
      const deletedCsrfTokens = await this.cleanupModelWithBatching(
        'CSRF tokens',
        prisma.csrfToken,
        now,
        BATCH_SIZE
      )

      console.log(
        `✅ Cleanup completed: ${deletedRefreshTokens} refresh tokens, ${deletedVerificationTokens} verification tokens, ${deletedResetTokens} reset tokens, ${deletedCsrfTokens} CSRF tokens deleted`
      )
    } catch (error) {
      console.error('❌ Error during token cleanup:', error)
    }
  }

  /**
   * Nettoie un modèle spécifique par batches
   * @param _modelName - Nom du modèle pour les logs (non utilisé actuellement)
   * @param model - Modèle Prisma à nettoyer
   * @param now - Date actuelle
   * @param batchSize - Taille des batches
   * @returns Nombre total de tokens supprimés
   */
  private static async cleanupModelWithBatching(
    _modelName: string,
    model: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    now: Date,
    batchSize: number
  ): Promise<number> {
    let totalDeleted = 0
    let batchDeleted = 0

    do {
      // Supprimer un batch
      const result = await model.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
        take: batchSize,
      })

      batchDeleted = result.count
      totalDeleted += batchDeleted

      // Pause entre batches pour libérer les locks DB
      // Permet aux autres queries de s'exécuter
      if (batchDeleted === batchSize) {
        await new Promise((resolve) => setTimeout(resolve, 100)) // 100ms pause
      }
    } while (batchDeleted === batchSize)

    return totalDeleted
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
