import { randomBytes } from 'crypto'
import { prisma } from '../config/prisma'
import { EmailService } from './email.service'

/**
 * Service de vérification d'email
 * Gère la création et la vérification des tokens d'email
 */
export class VerificationService {
  /**
   * Crée un token de vérification et envoie l'email
   * @param userId - ID de l'utilisateur
   * @param email - Email de l'utilisateur
   * @returns Le token généré
   */
  static async createVerificationToken(userId: string, email: string): Promise<string> {
    // Générer un token sécurisé de 32 bytes (64 caractères hex)
    const token = randomBytes(32).toString('hex')

    // Expiration dans 24 heures
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    // Supprimer les anciens tokens de vérification de cet utilisateur
    await prisma.verificationToken.deleteMany({
      where: { userId },
    })

    // Créer le nouveau token en base de données
    await prisma.verificationToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    })

    // Envoyer l'email de vérification
    await EmailService.sendVerificationEmail(email, token)

    return token
  }

  /**
   * Vérifie un token et marque l'email comme vérifié
   * @param token - Le token à vérifier
   * @returns L'utilisateur vérifié
   */
  static async verifyEmail(token: string) {
    // Trouver le token en base de données
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!verificationToken) {
      throw new Error('Token invalide')
    }

    // Vérifier que le token n'est pas expiré
    if (verificationToken.expiresAt < new Date()) {
      throw new Error('Token expiré')
    }

    // Marquer l'email comme vérifié
    await prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true },
    })

    // Supprimer le token utilisé
    await prisma.verificationToken.delete({
      where: { id: verificationToken.id },
    })

    return verificationToken.user
  }

  /**
   * Renvoie un email de vérification
   * @param email - Email de l'utilisateur
   */
  static async resendVerification(email: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      throw new Error('Utilisateur introuvable')
    }

    if (user.emailVerified) {
      throw new Error('Email déjà vérifié')
    }

    return this.createVerificationToken(user.id, user.email)
  }
}
