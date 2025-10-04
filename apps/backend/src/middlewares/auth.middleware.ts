import type { FastifyRequest, FastifyReply } from 'fastify'
import { authService } from '@/services/auth.service'

/**
 * Middleware d'authentification JWT
 * Vérifie le token dans le header Authorization et injecte userId dans request.user
 *
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 * @throws 401 si token manquant, invalide ou expiré
 *
 * @example
 * ```typescript
 * // Dans une route protégée
 * app.get('/api/auth/me', {
 *   preHandler: authMiddleware
 * }, async (request, reply) => {
 *   const userId = request.user.userId  // Injecté par le middleware
 *   const user = await authService.getCurrentUser(userId)
 *   return { user }
 * })
 * ```
 *
 * @example
 * ```bash
 * # Requête avec token
 * curl -H "Authorization: Bearer eyJhbGc..." http://localhost:3001/api/auth/me
 * ```
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
