import type { FastifyRequest, FastifyReply } from 'fastify'
import { authService } from '@/services/auth.service'
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  type RegisterDTO,
  type LoginDTO,
  type RefreshTokenDTO,
} from '@/schemas/auth.schema'

/**
 * Controller d'authentification
 * Gère les routes : /register, /login, /refresh, /logout, /me
 */
export class AuthController {
  /**
   * POST /api/auth/register
   * Inscrit un nouvel utilisateur
   */
  async register(
    request: FastifyRequest<{ Body: RegisterDTO }>,
    reply: FastifyReply
  ) {
    try {
      // Valider les données
      const data = registerSchema.parse(request.body)

      // Créer l'utilisateur
      const result = await authService.register(data)

      return reply.status(201).send({
        success: true,
        data: result,
      })
    } catch (error) {
      if (error instanceof Error) {
        // Email déjà utilisé
        if (error.message === 'Email already in use') {
          return reply.status(409).send({
            success: false,
            error: 'Email already in use',
          })
        }

        // Erreur de validation Zod
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Validation error',
            details: error,
          })
        }
      }

      // Erreur serveur
      request.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
      })
    }
  }

  /**
   * POST /api/auth/login
   * Connecte un utilisateur
   */
  async login(
    request: FastifyRequest<{ Body: LoginDTO }>,
    reply: FastifyReply
  ) {
    try {
      // Valider les données
      const data = loginSchema.parse(request.body)

      // Authentifier l'utilisateur
      const result = await authService.login(data)

      return reply.status(200).send({
        success: true,
        data: result,
      })
    } catch (error) {
      if (error instanceof Error) {
        // Credentials invalides
        if (error.message === 'Invalid credentials') {
          return reply.status(401).send({
            success: false,
            error: 'Invalid credentials',
          })
        }

        // Erreur de validation Zod
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Validation error',
            details: error,
          })
        }
      }

      // Erreur serveur
      request.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
      })
    }
  }

  /**
   * POST /api/auth/refresh
   * Rafraîchit l'access token
   */
  async refresh(
    request: FastifyRequest<{ Body: RefreshTokenDTO }>,
    reply: FastifyReply
  ) {
    try {
      // Valider les données
      const { refreshToken } = refreshTokenSchema.parse(request.body)

      // Rafraîchir les tokens
      const result = await authService.refresh(refreshToken)

      return reply.status(200).send({
        success: true,
        data: result,
      })
    } catch (error) {
      if (error instanceof Error) {
        // Refresh token invalide ou expiré
        if (
          error.message === 'Invalid or expired refresh token' ||
          error.message === 'User not found'
        ) {
          return reply.status(401).send({
            success: false,
            error: 'Invalid or expired refresh token',
          })
        }

        // Erreur de validation Zod
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Validation error',
            details: error,
          })
        }
      }

      // Erreur serveur
      request.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
      })
    }
  }

  /**
   * POST /api/auth/logout
   * Déconnecte un utilisateur (côté client, invalider les tokens)
   */
  async logout(request: FastifyRequest, reply: FastifyReply) {
    // Note: Avec JWT stateless, le logout est géré côté client
    // Le client doit supprimer les tokens du localStorage/cookies
    // Pour un vrai logout serveur, il faudrait une blacklist de tokens
    return reply.status(200).send({
      success: true,
      message: 'Logged out successfully',
    })
  }

  /**
   * GET /api/auth/me
   * Récupère l'utilisateur courant (nécessite authentication)
   */
  async me(request: FastifyRequest, reply: FastifyReply) {
    try {
      // userId sera injecté par le middleware d'auth
      const userId = request.user?.userId

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Unauthorized',
        })
      }

      // Récupérer l'utilisateur
      const user = await authService.getCurrentUser(userId)

      return reply.status(200).send({
        success: true,
        data: { user },
      })
    } catch (error) {
      if (error instanceof Error) {
        // Utilisateur non trouvé
        if (error.message === 'User not found') {
          return reply.status(404).send({
            success: false,
            error: 'User not found',
          })
        }
      }

      // Erreur serveur
      request.log.error(error)
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
      })
    }
  }
}

// Export instance singleton
export const authController = new AuthController()
