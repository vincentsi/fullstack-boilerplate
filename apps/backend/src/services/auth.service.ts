import type { User } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '@/config/env'
import { prisma } from '@/config/prisma'
import type { RegisterDTO, LoginDTO } from '@/schemas/auth.schema'
import { VerificationService } from './verification.service'

/**
 * Service d'authentification
 * Gère l'inscription, connexion, et génération de tokens JWT
 */
export class AuthService {
  /**
   * Hash un password avec bcrypt
   * @param password - Password en clair
   * @returns Password hashé
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10
    return bcrypt.hash(password, saltRounds)
  }

  /**
   * Compare un password avec son hash
   * @param password - Password en clair
   * @param hashedPassword - Password hashé
   * @returns true si match, false sinon
   */
  private async comparePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  /**
   * Génère un access token JWT
   * @param userId - ID de l'utilisateur
   * @param role - Rôle de l'utilisateur (pour RBAC sans requête DB)
   * @returns Access token (expire dans 15 minutes)
   */
  private generateAccessToken(userId: string, role: string): string {
    return jwt.sign({ userId, role }, env.JWT_SECRET, {
      expiresIn: '15m',
    })
  }

  /**
   * Génère un refresh token JWT
   * @param userId - ID de l'utilisateur
   * @returns Refresh token (expire dans 7 jours)
   */
  private generateRefreshToken(userId: string): string {
    return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
      expiresIn: '7d',
    })
  }

  /**
   * Stocke un refresh token en DB
   * @param token - Refresh token à stocker
   * @param userId - ID de l'utilisateur
   */
  private async storeRefreshToken(token: string, userId: string): Promise<void> {
    await prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
      },
    })
  }

  /**
   * Vérifie un access token
   * @param token - JWT access token
   * @returns Payload du token si valide (userId et role)
   * @throws Error si token invalide ou expiré
   *
   * @example
   * ```typescript
   * try {
   *   const payload = authService.verifyAccessToken('eyJhbGc...')
   *   console.log(payload.userId)  // "clxxx..."
   *   console.log(payload.role)    // "USER"
   * } catch (error) {
   *   console.error('Invalid token')
   * }
   * ```
   */
  verifyAccessToken(token: string): { userId: string; role: string } {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string; role: string }
      return payload
    } catch {
      throw new Error('Invalid or expired access token')
    }
  }

  /**
   * Vérifie un refresh token
   * @param token - JWT refresh token
   * @returns Payload du token si valide
   * @throws Error si token invalide ou expiré
   */
  verifyRefreshToken(token: string): { userId: string } {
    try {
      const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as {
        userId: string
      }
      return payload
    } catch {
      throw new Error('Invalid or expired refresh token')
    }
  }

  /**
   * Inscrit un nouvel utilisateur
   * @param data - Données d'inscription (email, password, name optionnel)
   * @returns Utilisateur créé avec access et refresh tokens
   * @throws Error si email déjà utilisé
   *
   * @example
   * ```typescript
   * const result = await authService.register({
   *   email: 'user@example.com',
   *   password: 'SecurePass123',
   *   name: 'John Doe'
   * })
   *
   * console.log(result.user.id)           // "clxxx..."
   * console.log(result.accessToken)       // "eyJhbGc..."
   * console.log(result.refreshToken)      // "eyJhbGc..."
   * ```
   */
  async register(data: RegisterDTO): Promise<{
    user: Omit<User, 'password'>
    accessToken: string
    refreshToken: string
  }> {
    // Vérifier si email existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (existingUser) {
      throw new Error('Email already in use')
    }

    // Hash le password
    const hashedPassword = await this.hashPassword(data.password)

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        emailVerified: false, // Email non vérifié par défaut
      },
    })

    // Envoyer l'email de vérification
    await VerificationService.createVerificationToken(user.id, user.email)

    // Générer les tokens
    const accessToken = this.generateAccessToken(user.id, user.role)
    const refreshToken = this.generateRefreshToken(user.id)

    // Stocker le refresh token en DB
    await this.storeRefreshToken(refreshToken, user.id)

    // Retourner l'utilisateur sans le password
    const { password: _, ...userWithoutPassword } = user

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    }
  }

  /**
   * Connecte un utilisateur
   * @param data - Credentials de connexion (email, password)
   * @returns Utilisateur avec access et refresh tokens
   * @throws Error si credentials invalides
   *
   * @example
   * ```typescript
   * const result = await authService.login({
   *   email: 'user@example.com',
   *   password: 'SecurePass123'
   * })
   *
   * console.log(result.user.email)        // "user@example.com"
   * console.log(result.accessToken)       // "eyJhbGc..." (expire 15min)
   * console.log(result.refreshToken)      // "eyJhbGc..." (expire 7 jours)
   * ```
   */
  async login(data: LoginDTO): Promise<{
    user: Omit<User, 'password'>
    accessToken: string
    refreshToken: string
  }> {
    // Trouver l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    })

    // Fix timing attack: always run bcrypt.compare even if user doesn't exist
    // This ensures constant-time response regardless of email validity
    const passwordToCompare = user?.password || '$2a$10$invalidhashxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    const isPasswordValid = await this.comparePassword(
      data.password,
      passwordToCompare
    )

    // Only check validity if user exists
    if (!user || !isPasswordValid) {
      throw new Error('Invalid credentials')
    }

    // Générer les tokens
    const accessToken = this.generateAccessToken(user.id, user.role)
    const refreshToken = this.generateRefreshToken(user.id)

    // Stocker le refresh token en DB
    await this.storeRefreshToken(refreshToken, user.id)

    // Retourner l'utilisateur sans le password
    const { password: _, ...userWithoutPassword } = user

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    }
  }

  /**
   * Rafraîchit l'access token avec un refresh token
   * @param refreshToken - Refresh token valide (7 jours)
   * @returns Nouveau access token et refresh token
   * @throws Error si refresh token invalide ou utilisateur supprimé
   *
   * @example
   * ```typescript
   * const tokens = await authService.refresh('eyJhbGc...')
   *
   * console.log(tokens.accessToken)       // Nouveau token (15min)
   * console.log(tokens.refreshToken)      // Nouveau refresh token (7j)
   * ```
   */
  async refresh(refreshToken: string): Promise<{
    accessToken: string
    refreshToken: string
  }> {
    // Vérifier le refresh token JWT
    this.verifyRefreshToken(refreshToken)

    // Vérifier le token en DB (pas révoqué, pas expiré)
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    })

    if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
      throw new Error('Invalid or expired refresh token')
    }

    // Vérifier que l'utilisateur existe toujours
    if (!storedToken.user) {
      throw new Error('User not found')
    }

    // Révoquer l'ancien token (rotation)
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    })

    // Générer de nouveaux tokens
    const newAccessToken = this.generateAccessToken(storedToken.userId, storedToken.user.role)
    const newRefreshToken = this.generateRefreshToken(storedToken.userId)

    // Stocker le nouveau refresh token en DB
    await this.storeRefreshToken(newRefreshToken, storedToken.userId)

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    }
  }

  /**
   * Déconnecte un utilisateur en révoquant ses refresh tokens
   * @param userId - ID de l'utilisateur
   * @param refreshToken - Token spécifique à révoquer (optionnel)
   *
   * @example
   * ```typescript
   * // Révoquer un token spécifique
   * await authService.logout(userId, 'eyJhbGc...')
   *
   * // Révoquer tous les tokens de l'utilisateur
   * await authService.logout(userId)
   * ```
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Révoquer le token spécifique
      await prisma.refreshToken.updateMany({
        where: {
          userId,
          token: refreshToken,
        },
        data: { revoked: true },
      })
    } else {
      // Révoquer tous les tokens de l'utilisateur
      await prisma.refreshToken.updateMany({
        where: { userId },
        data: { revoked: true },
      })
    }
  }

  /**
   * Récupère l'utilisateur courant par son ID
   * @param userId - ID de l'utilisateur
   * @returns Utilisateur sans password
   * @throws Error si utilisateur non trouvé
   */
  async getCurrentUser(userId: string): Promise<Omit<User, 'password'>> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const { password: _, ...userWithoutPassword } = user
    return userWithoutPassword
  }
}

// Export instance singleton
export const authService = new AuthService()
