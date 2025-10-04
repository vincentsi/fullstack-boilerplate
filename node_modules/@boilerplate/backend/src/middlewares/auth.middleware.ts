import type { FastifyRequest, FastifyReply } from 'fastify'
import { authService } from '@/services/auth.service'

/**
 * Middleware d'authentification JWT
 * Vérifie le token dans le header Authorization
 * Injecte userId dans request.user si valide
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Récupérer le token depuis le header Authorization
    const authHeader = request.headers.authorization

    if (!authHeader) {
      return reply.status(401).send({
        success: false,
        error: 'No authorization header provided',
      })
    }

    // Format: "Bearer <token>"
    const parts = authHeader.split(' ')

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return reply.status(401).send({
        success: false,
        error: 'Invalid authorization header format. Expected: Bearer <token>',
      })
    }

    const token = parts[1]

    if (!token) {
      return reply.status(401).send({
        success: false,
        error: 'Token not provided',
      })
    }

    // Vérifier le token
    const payload = authService.verifyAccessToken(token)

    // Injecter userId dans request pour les handlers
    request.user = { userId: payload.userId }
  } catch (error) {
    if (error instanceof Error) {
      return reply.status(401).send({
        success: false,
        error: error.message,
      })
    }

    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
    })
  }
}
