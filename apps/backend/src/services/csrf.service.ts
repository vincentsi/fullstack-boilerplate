import { randomBytes } from 'crypto'
import { prisma } from '../config/prisma'

/**
 * Service de gestion des tokens CSRF
 * Protection contre les attaques Cross-Site Request Forgery
 */
export class CsrfService {
  /**
   * Génère un nouveau token CSRF pour un utilisateur
   * @param userId - ID de l'utilisateur
   * @returns Token CSRF généré
   */
  static async generateToken(userId: string): Promise<string> {
    // Générer token cryptographiquement sécurisé
    const token = randomBytes(32).toString('hex')

    // Expiration dans 1 heure
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    // Supprimer les anciens tokens de cet utilisateur
    await prisma.csrfToken.deleteMany({
      where: { userId },
    })

    // Créer le nouveau token
    await prisma.csrfToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    })

    return token
  }

  /**
   * Vérifie la validité d'un token CSRF
   * @param token - Token à vérifier
   * @param userId - ID de l'utilisateur
   * @returns true si valide, false sinon
   */
  static async verifyToken(token: string, userId: string): Promise<boolean> {
    const csrfToken = await prisma.csrfToken.findFirst({
      where: {
        token,
        userId,
      },
    })

    if (!csrfToken) {
      return false
    }

    // Vérifier l'expiration
    if (csrfToken.expiresAt < new Date()) {
      // Supprimer le token expiré
      await prisma.csrfToken.delete({
        where: { id: csrfToken.id },
      })
      return false
    }

    return true
  }

  /**
   * Supprime tous les tokens CSRF d'un utilisateur
   * @param userId - ID de l'utilisateur
   */
  static async revokeUserTokens(userId: string): Promise<void> {
    await prisma.csrfToken.deleteMany({
      where: { userId },
    })
  }
}
