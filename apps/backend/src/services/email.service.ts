import { env } from '../config/env'

/**
 * Service d'envoi d'emails
 * En développement: affiche les liens dans la console
 * En production: à intégrer avec un service comme Resend, SendGrid, etc.
 */
export class EmailService {
  /**
   * Envoie un email de vérification avec un lien contenant le token
   */
  static async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`

    if (env.NODE_ENV === 'development') {
      console.log('\n📧 ═══════════════════════════════════════════')
      console.log('   EMAIL DE VÉRIFICATION')
      console.log('═══════════════════════════════════════════')
      console.log(`To: ${email}`)
      console.log(`URL: ${verificationUrl}`)
      console.log(`Token: ${token}`)
      console.log('═══════════════════════════════════════════\n')
      return
    }

    // TODO: En production, intégrer un service d'email
    // Exemple avec Resend:
    // await resend.emails.send({
    //   from: 'noreply@votreapp.com',
    //   to: email,
    //   subject: 'Vérifiez votre email',
    //   html: `<a href="${verificationUrl}">Cliquez ici pour vérifier votre email</a>`
    // })
  }

  /**
   * Envoie un email de réinitialisation de mot de passe
   */
  static async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`

    if (env.NODE_ENV === 'development') {
      console.log('\n📧 ═══════════════════════════════════════════')
      console.log('   EMAIL DE RÉINITIALISATION')
      console.log('═══════════════════════════════════════════')
      console.log(`To: ${email}`)
      console.log(`URL: ${resetUrl}`)
      console.log(`Token: ${token}`)
      console.log('═══════════════════════════════════════════\n')
      return
    }

    // TODO: En production, intégrer un service d'email
  }
}
