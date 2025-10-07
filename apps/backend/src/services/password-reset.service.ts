import { randomBytes } from 'crypto'
import { prisma } from '../config/prisma'
import { EmailService } from './email.service'
import { AuthService } from './auth.service'

/**
 * Service de réinitialisation de mot de passe
 * Gère les demandes de reset et la réinitialisation
 */
export class PasswordResetService {
  /**
   * Crée une demande de réinitialisation de mot de passe
   * @param email - Email de l'utilisateur
   * @returns Success (même si l'email n'existe pas, pour la sécurité)
   */
  static async requestReset(email: string): Promise<{ success: boolean }> {
    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Ne pas révéler si l'email existe ou non (sécurité)
    // Toujours retourner success pour ne pas permettre l'énumération d'emails
    if (!user) {
      return { success: true }
    }

    // Générer un token sécurisé de 32 bytes (64 caractères hex)
    const token = randomBytes(32).toString('hex')

    // Expiration dans 1 heure
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    // Supprimer les anciens tokens de reset de cet utilisateur
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    })

    // Créer le nouveau token en base de données
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    })

    // Envoyer l'email de réinitialisation
    await EmailService.sendPasswordResetEmail(email, token)

    return { success: true }
  }

  /**
   * Vérifie la validité d'un token de réinitialisation
   * @param token - Le token à vérifier
   * @returns Le token si valide
   * @throws Error si token invalide ou expiré
   */
  static async verifyResetToken(token: string) {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    })

    if (!resetToken) {
      throw new Error('Token invalide')
    }

    if (resetToken.expiresAt < new Date()) {
      throw new Error('Token expiré')
    }

    return resetToken
  }

  /**
   * Réinitialise le mot de passe d'un utilisateur
   * @param token - Token de réinitialisation
   * @param newPassword - Nouveau mot de passe
   * @returns Success
   */
  static async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ success: boolean }> {
    // Vérifier que le token est valide
    const resetToken = await this.verifyResetToken(token)

    // Hasher le nouveau mot de passe
    const authService = new AuthService()
    const hashedPassword = await authService.hashPassword(newPassword)

    // Mettre à jour le mot de passe
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    })

    // Supprimer tous les tokens de reset de cet utilisateur
    await prisma.passwordResetToken.deleteMany({
      where: { userId: resetToken.userId },
    })

    // Révoquer tous les refresh tokens pour des raisons de sécurité
    // L'utilisateur devra se reconnecter partout
    await prisma.refreshToken.updateMany({
      where: { userId: resetToken.userId },
      data: { revoked: true },
    })

    return { success: true }
  }
}
