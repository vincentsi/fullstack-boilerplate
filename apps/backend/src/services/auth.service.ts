import { PrismaClient, User } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '@/config/env'
import type { RegisterDTO, LoginDTO } from '@/schemas/auth.schema'

const prisma = new PrismaClient()

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
  private async hashPassword(password: string): Promise<string> {
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
   * @returns Access token (expire dans 15 minutes)
   */
  private generateAccessToken(userId: string): string {
    return jwt.sign({ userId }, env.JWT_SECRET, {
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
   * Vérifie un access token
   * @param token - JWT access token
   * @returns Payload du token si valide
   * @throws Error si token invalide ou expiré
   */
  verifyAccessToken(token: string): { userId: string } {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string }
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
   * @param data - Données d'inscription
   * @returns Utilisateur créé avec access et refresh tokens
   * @throws Error si email déjà utilisé
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
      },
    })

    // Générer les tokens
    const accessToken = this.generateAccessToken(user.id)
    const refreshToken = this.generateRefreshToken(user.id)

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
   * @param data - Credentials de connexion
   * @returns Utilisateur avec access et refresh tokens
   * @throws Error si credentials invalides
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

    if (!user) {
      throw new Error('Invalid credentials')
    }

    // Vérifier le password
    const isPasswordValid = await this.comparePassword(
      data.password,
      user.password
    )

    if (!isPasswordValid) {
      throw new Error('Invalid credentials')
    }

    // Générer les tokens
    const accessToken = this.generateAccessToken(user.id)
    const refreshToken = this.generateRefreshToken(user.id)

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
   * @param refreshToken - Refresh token
   * @returns Nouveau access token et refresh token
   * @throws Error si refresh token invalide
   */
  async refresh(refreshToken: string): Promise<{
    accessToken: string
    refreshToken: string
  }> {
    // Vérifier le refresh token
    const payload = this.verifyRefreshToken(refreshToken)

    // Vérifier que l'utilisateur existe toujours
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Générer de nouveaux tokens
    const newAccessToken = this.generateAccessToken(user.id)
    const newRefreshToken = this.generateRefreshToken(user.id)

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
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
